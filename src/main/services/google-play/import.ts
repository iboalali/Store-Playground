import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import https from 'https'
import http from 'http'
import type { androidpublisher_v3 } from 'googleapis'
import type { ProgressEvent } from '$shared/types/models'
import type { AppConfig, AppDetails, VersionMetadata } from '$shared/types/models'
import { IMAGE_FILE_TO_API_TYPE, DIR_TO_API_TYPE } from '../../constants'
import { getAndroidPublisher } from './auth'

interface ImportParams {
  packageName: string
  serviceAccountKeyPath: string
  targetDir: string
  mode: 'new-app' | 'overwrite-version'
}

class ProgressTracker {
  private event: ProgressEvent
  private onProgress: (event: ProgressEvent) => void

  constructor(operationType: 'publish' | 'import', onProgress: (event: ProgressEvent) => void) {
    this.event = { operationType, steps: [], finished: false }
    this.onProgress = onProgress
  }

  addStep(id: string, label: string): void {
    this.event.steps.push({ id, label, status: 'pending' })
    this.emit()
  }

  startStep(id: string): void {
    const step = this.event.steps.find((s) => s.id === id)
    if (step) step.status = 'active'
    this.emit()
  }

  completeStep(id: string): void {
    const step = this.event.steps.find((s) => s.id === id)
    if (step) step.status = 'done'
    this.emit()
  }

  failStep(id: string, error: string): void {
    const step = this.event.steps.find((s) => s.id === id)
    if (step) {
      step.status = 'error'
      step.error = error
    }
    this.emit()
  }

  finish(abortError?: string): void {
    this.event.finished = true
    if (abortError) this.event.abortError = abortError
    this.emit()
  }

  private emit(): void {
    this.onProgress({ ...this.event, steps: this.event.steps.map((s) => ({ ...s })) })
  }
}

async function downloadImage(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    client.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadImage(res.headers.location).then(resolve, reject)
        return
      }
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode} downloading image`))
        return
      }
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    }).on('error', reject)
  })
}

// Reverse mapping: API type -> local file name
const API_TYPE_TO_IMAGE_FILE: Record<string, string> = {}
for (const [file, apiType] of Object.entries(IMAGE_FILE_TO_API_TYPE)) {
  API_TYPE_TO_IMAGE_FILE[apiType] = file
}

// Reverse mapping: API type -> directory name
const API_TYPE_TO_DIR: Record<string, string> = {}
for (const [dir, apiType] of Object.entries(DIR_TO_API_TYPE)) {
  API_TYPE_TO_DIR[apiType] = dir
}

export async function importFromGooglePlay(
  params: ImportParams,
  onProgress: (event: ProgressEvent) => void
): Promise<void> {
  const { packageName, serviceAccountKeyPath, targetDir, mode } = params
  const tracker = new ProgressTracker('import', onProgress)

  tracker.addStep('auth', 'Authenticating...')
  tracker.addStep('edit-insert', 'Creating read-only edit...')
  tracker.addStep('details', 'Fetching app details...')
  tracker.addStep('listings', 'Fetching listings...')

  let publisher: androidpublisher_v3.Androidpublisher
  let editId: string | undefined

  try {
    // Authenticate
    tracker.startStep('auth')
    publisher = await getAndroidPublisher(serviceAccountKeyPath)
    tracker.completeStep('auth')

    // Insert edit
    tracker.startStep('edit-insert')
    const editRes = await publisher.edits.insert({
      packageName,
      requestBody: {}
    })
    editId = editRes.data.id!
    tracker.completeStep('edit-insert')

    // Fetch app details
    tracker.startStep('details')
    const detailsRes = await publisher.edits.details.get({ packageName, editId })
    const apiDetails = detailsRes.data

    if (mode === 'new-app') {
      await mkdir(targetDir, { recursive: true })

      const appConfig: AppConfig = {
        appName: packageName.split('.').pop() || packageName,
        packageName,
        liveVersionDir: 'live'
      }
      await writeFile(join(targetDir, 'app_config.json'), JSON.stringify(appConfig, null, 2))

      const appDetails: AppDetails = {
        defaultLanguage: apiDetails.defaultLanguage || 'en-US',
        contactEmail: apiDetails.contactEmail || '',
        contactWebsite: apiDetails.contactWebsite || '',
        contactPhone: apiDetails.contactPhone || '',
        privacyPolicyUrl: ''
      }
      await writeFile(join(targetDir, 'app_details.json'), JSON.stringify(appDetails, null, 2))
    }
    tracker.completeStep('details')

    // Fetch listings
    tracker.startStep('listings')
    const listingsRes = await publisher.edits.listings.list({ packageName, editId })
    const listings = listingsRes.data.listings || []
    tracker.completeStep('listings')

    // Determine the version directory where locale data goes
    const versionDir = mode === 'new-app' ? join(targetDir, 'live') : targetDir

    // Add per-locale steps
    for (const listing of listings) {
      const locale = listing.language!
      tracker.addStep(`locale-${locale}`, `Importing ${locale}...`)
    }

    // Process each locale
    for (const listing of listings) {
      const locale = listing.language!
      const stepId = `locale-${locale}`
      tracker.startStep(stepId)

      const localePath = join(versionDir, locale)
      await mkdir(localePath, { recursive: true })

      // Write text files
      await writeFile(join(localePath, 'title.txt'), listing.title || '')
      await writeFile(join(localePath, 'short_description.txt'), listing.shortDescription || '')
      await writeFile(join(localePath, 'full_description.txt'), listing.fullDescription || '')
      await writeFile(join(localePath, 'video_url.txt'), listing.video || '')

      // Download non-screenshot images (icon, feature graphic, tv banner)
      for (const [apiType, fileName] of Object.entries(API_TYPE_TO_IMAGE_FILE)) {
        try {
          const imgRes = await publisher.edits.images.list({
            packageName,
            editId,
            language: locale,
            imageType: apiType
          })
          const images = imgRes.data.images || []
          if (images.length > 0 && images[0].url) {
            const buffer = await downloadImage(images[0].url)
            await writeFile(join(localePath, fileName), buffer)
          }
        } catch {
          // Image type may not exist for this locale — skip
        }
      }

      // Download screenshots
      for (const [apiType, dirName] of Object.entries(API_TYPE_TO_DIR)) {
        try {
          const imgRes = await publisher.edits.images.list({
            packageName,
            editId,
            language: locale,
            imageType: apiType
          })
          const images = imgRes.data.images || []
          if (images.length > 0) {
            const screenshotDir = join(localePath, 'screenshots', dirName)
            await mkdir(screenshotDir, { recursive: true })

            for (let i = 0; i < images.length; i++) {
              const img = images[i]
              if (img.url) {
                const buffer = await downloadImage(img.url)
                const ext = 'png'
                const fileName = `${String(i + 1).padStart(2, '0')}.${ext}`
                await writeFile(join(screenshotDir, fileName), buffer)
              }
            }
          }
        } catch {
          // Screenshot type may not exist — skip
        }
      }

      tracker.completeStep(stepId)
    }

    // Write version metadata if creating new app
    if (mode === 'new-app') {
      await mkdir(versionDir, { recursive: true })
      const metadata: VersionMetadata = {
        createdAt: new Date().toISOString(),
        status: 'published',
        customNotes: 'Imported from Google Play'
      }
      await writeFile(join(versionDir, 'version_metadata.json'), JSON.stringify(metadata, null, 2))
    }

    // Cleanup: delete the read-only edit (no commit)
    try {
      await publisher.edits.delete({ packageName, editId })
    } catch {
      // Best-effort cleanup
    }

    tracker.finish()
  } catch (err) {
    // Cleanup edit on error
    if (editId && publisher!) {
      try {
        await publisher!.edits.delete({ packageName, editId })
      } catch {
        // Best-effort cleanup
      }
    }
    tracker.finish(String(err))
    throw err
  }
}
