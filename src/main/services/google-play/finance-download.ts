import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeFile, mkdir, unlink, readdir } from 'node:fs/promises'
import AdmZip from 'adm-zip'
import { getStorageClient } from './auth'
import { importCsv, getIndex } from '../reports'
import type { EarningsReportInfo, DownloadRemoteResult } from '$shared/types/models'

/**
 * Parse a month key from an earnings report filename.
 * Filenames follow patterns like:
 *   earnings_YYYYMM_<id>.csv
 *   earnings_YYYYMM_<id>.zip
 *   PlayApps_YYYYMM.csv
 */
function extractMonthKey(objectName: string): string | null {
  const basename = objectName.split('/').pop() ?? ''
  const match = basename.match(/(\d{4})(\d{2})/)
  if (!match) return null
  const year = match[1]
  const month = match[2]
  if (parseInt(month, 10) < 1 || parseInt(month, 10) > 12) return null
  return `${year}-${month}`
}

/**
 * List all earnings report objects in a GCS bucket.
 */
export async function listEarningsReports(
  keyPath: string,
  bucketId: string
): Promise<EarningsReportInfo[]> {
  const storage = await getStorageClient(keyPath)

  const reports: EarningsReportInfo[] = []
  let pageToken: string | undefined

  do {
    const res = await storage.objects.list({
      bucket: bucketId,
      prefix: 'earnings/',
      pageToken
    })

    const items = res.data.items ?? []
    for (const item of items) {
      const name = item.name
      if (!name) continue
      // Skip directory placeholder objects
      if (name.endsWith('/')) continue
      // Only include .csv and .zip files
      if (!name.endsWith('.csv') && !name.endsWith('.zip')) continue

      const monthKey = extractMonthKey(name)
      if (!monthKey) continue

      reports.push({
        objectName: name,
        monthKey,
        sizeBytes: parseInt(String(item.size ?? '0'), 10)
      })
    }

    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken)

  return reports.sort((a, b) => a.monthKey.localeCompare(b.monthKey))
}

/**
 * Download a single object from GCS to a local path.
 */
async function downloadObject(
  keyPath: string,
  bucketId: string,
  objectName: string,
  destPath: string
): Promise<void> {
  const storage = await getStorageClient(keyPath)

  const res = await storage.objects.get(
    { bucket: bucketId, object: objectName, alt: 'media' },
    { responseType: 'arraybuffer' }
  )

  await writeFile(destPath, Buffer.from(res.data as ArrayBuffer))
}

/**
 * Extract CSV files from a ZIP archive.
 * Returns paths to extracted CSV files.
 */
function extractCsvsFromZip(zipPath: string, destDir: string): string[] {
  const zip = new AdmZip(zipPath)
  const entries = zip.getEntries()
  const csvPaths: string[] = []

  for (const entry of entries) {
    if (entry.isDirectory) continue
    if (!entry.entryName.endsWith('.csv')) continue

    const outPath = join(destDir, entry.entryName.split('/').pop() ?? entry.entryName)
    zip.extractEntryTo(entry, destDir, false, true)
    csvPaths.push(outPath)
  }

  return csvPaths
}

/**
 * Download new earnings reports from GCS and import them via the existing CSV pipeline.
 * Returns a summary of what was imported vs skipped.
 */
export async function downloadAndImportNewReports(
  keyPath: string,
  bucketId: string,
  workspacePath: string
): Promise<DownloadRemoteResult> {
  // List remote reports
  const remoteReports = await listEarningsReports(keyPath, bucketId)

  if (remoteReports.length === 0) {
    return { imported: 0, skipped: 0, errors: [] }
  }

  // Check which months are already imported
  const index = await getIndex(workspacePath)
  const importedMonths = new Set(index.importedFiles.map((f) => f.monthKey))

  // Filter to new reports only
  const newReports = remoteReports.filter((r) => !importedMonths.has(r.monthKey))

  if (newReports.length === 0) {
    return { imported: 0, skipped: remoteReports.length, errors: [] }
  }

  // Create temp directory for downloads
  const tempDir = join(tmpdir(), `store-playground-finance-${Date.now()}`)
  await mkdir(tempDir, { recursive: true })

  const result: DownloadRemoteResult = {
    imported: 0,
    skipped: remoteReports.length - newReports.length,
    errors: []
  }

  try {
    for (const report of newReports) {
      try {
        const filename = report.objectName.split('/').pop() ?? report.objectName
        const downloadPath = join(tempDir, filename)

        // Download from GCS
        await downloadObject(keyPath, bucketId, report.objectName, downloadPath)

        // Handle ZIP or CSV
        let csvPaths: string[]
        if (filename.endsWith('.zip')) {
          csvPaths = extractCsvsFromZip(downloadPath, tempDir)
        } else {
          csvPaths = [downloadPath]
        }

        // Import each CSV through the existing pipeline
        for (const csvPath of csvPaths) {
          await importCsv(csvPath, workspacePath)
        }

        result.imported++
      } catch (err) {
        result.errors.push(`${report.objectName}: ${String(err)}`)
      }
    }
  } finally {
    // Clean up temp directory
    try {
      const files = await readdir(tempDir)
      for (const file of files) {
        await unlink(join(tempDir, file)).catch(() => {})
      }
      // Remove the temp dir itself (rmdir only works on empty dirs)
      const { rmdir } = await import('node:fs/promises')
      await rmdir(tempDir).catch(() => {})
    } catch {
      // Best-effort cleanup
    }
  }

  return result
}
