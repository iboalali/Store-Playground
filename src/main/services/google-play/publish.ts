import { readdir, readFile, access } from 'fs/promises'
import { createReadStream } from 'fs'
import { join } from 'path'
import type { androidpublisher_v3 } from 'googleapis'
import type { ProgressEvent, ProgressStep } from '$shared/types/models'
import type { AppDetails } from '$shared/types/models'
import { IMAGE_FILE_TO_API_TYPE, DIR_TO_API_TYPE } from '../../constants'
import { getAndroidPublisher } from './auth'
import { computeLocalHash, computeImageDiff } from './image-diff'
import type { LocalImageEntry, ApiImageEntry } from './image-diff'

interface PublishParams {
  packageName: string
  serviceAccountKeyPath: string
  versionDir: string
  appPath: string
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

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function readTextFileSafe(filePath: string): Promise<string> {
  try {
    return (await readFile(filePath, 'utf-8')).trim()
  } catch {
    return ''
  }
}

async function getLocaleDirectories(versionDir: string): Promise<string[]> {
  const entries = await readdir(versionDir, { withFileTypes: true })
  return entries
    .filter((e) => e.isDirectory() && e.name !== 'version_metadata.json')
    .map((e) => e.name)
    .filter((name) => !name.startsWith('.') && name !== 'screenshots')
}

async function getScreenshotFiles(screenshotDir: string): Promise<string[]> {
  try {
    const entries = await readdir(screenshotDir)
    return entries
      .filter((f) => /\.(png|jpe?g)$/i.test(f))
      .sort()
      .map((f) => join(screenshotDir, f))
  } catch {
    return []
  }
}

export async function publishToGooglePlay(
  params: PublishParams,
  onProgress: (event: ProgressEvent) => void
): Promise<void> {
  const { packageName, serviceAccountKeyPath, versionDir, appPath } = params
  const tracker = new ProgressTracker('publish', onProgress)

  // Plan steps
  tracker.addStep('auth', 'Authenticating...')
  tracker.addStep('edit-insert', 'Creating edit...')
  tracker.addStep('details', 'Updating app details...')

  // Discover locales to plan remaining steps
  const locales = await getLocaleDirectories(versionDir)
  for (const locale of locales) {
    tracker.addStep(`locale-${locale}-text`, `Updating ${locale} listing text...`)
    tracker.addStep(`locale-${locale}-images`, `Syncing ${locale} images...`)
    tracker.addStep(`locale-${locale}-screenshots`, `Syncing ${locale} screenshots...`)
  }
  tracker.addStep('commit', 'Committing edit...')
  tracker.addStep('post-commit', 'Updating local metadata...')

  let publisher: androidpublisher_v3.Androidpublisher
  let editId: string | undefined

  try {
    // Step: Authenticate
    tracker.startStep('auth')
    publisher = await getAndroidPublisher(serviceAccountKeyPath)
    tracker.completeStep('auth')

    // Step: Insert edit
    tracker.startStep('edit-insert')
    const editRes = await publisher.edits.insert({
      packageName,
      requestBody: {}
    })
    editId = editRes.data.id!
    tracker.completeStep('edit-insert')

    // Step: Update app details
    tracker.startStep('details')
    const detailsRaw = await readFile(join(appPath, 'app_details.json'), 'utf-8')
    const details = JSON.parse(detailsRaw) as AppDetails
    await publisher.edits.details.update({
      packageName,
      editId,
      requestBody: {
        defaultLanguage: details.defaultLanguage,
        contactEmail: details.contactEmail,
        contactWebsite: details.contactWebsite,
        contactPhone: details.contactPhone
      }
    })
    tracker.completeStep('details')

    // Per-locale steps
    for (const locale of locales) {
      const localePath = join(versionDir, locale)

      // Update listing text
      const textStepId = `locale-${locale}-text`
      tracker.startStep(textStepId)
      const title = await readTextFileSafe(join(localePath, 'title.txt'))
      const shortDescription = await readTextFileSafe(join(localePath, 'short_description.txt'))
      const fullDescription = await readTextFileSafe(join(localePath, 'full_description.txt'))
      const video = await readTextFileSafe(join(localePath, 'video_url.txt'))

      await publisher.edits.listings.update({
        packageName,
        editId,
        language: locale,
        requestBody: {
          language: locale,
          title: title || undefined,
          shortDescription: shortDescription || undefined,
          fullDescription: fullDescription || undefined,
          video: video || undefined
        }
      })
      tracker.completeStep(textStepId)

      // Sync non-screenshot images (icon, feature graphic, tv banner)
      const imageStepId = `locale-${locale}-images`
      tracker.startStep(imageStepId)
      for (const [fileName, apiType] of Object.entries(IMAGE_FILE_TO_API_TYPE)) {
        const localPath = join(localePath, fileName)
        const exists = await fileExists(localPath)

        // Delete all existing images of this type first
        try {
          await publisher.edits.images.deleteall({
            packageName,
            editId,
            language: locale,
            imageType: apiType
          })
        } catch {
          // May fail if no images exist — that's ok
        }

        // Upload if local file exists
        if (exists) {
          const mimeType = fileName.endsWith('.png') ? 'image/png' : 'image/jpeg'
          await publisher.edits.images.upload({
            packageName,
            editId,
            language: locale,
            imageType: apiType,
            media: {
              mimeType,
              body: createReadStream(localPath)
            }
          })
        }
      }
      tracker.completeStep(imageStepId)

      // Sync screenshots
      const screenshotStepId = `locale-${locale}-screenshots`
      tracker.startStep(screenshotStepId)
      for (const [dirName, apiType] of Object.entries(DIR_TO_API_TYPE)) {
        const screenshotDir = join(localePath, 'screenshots', dirName)
        const localFiles = await getScreenshotFiles(screenshotDir)

        // Get current API images
        let apiImages: ApiImageEntry[] = []
        try {
          const listRes = await publisher.edits.images.list({
            packageName,
            editId,
            language: locale,
            imageType: apiType
          })
          apiImages = (listRes.data.images || []).map((img) => ({
            id: img.id!,
            sha256: img.sha256!
          }))
        } catch {
          // No images for this type — that's ok
        }

        // Compute local hashes
        const localEntries: LocalImageEntry[] = []
        for (const filePath of localFiles) {
          const sha256 = await computeLocalHash(filePath)
          localEntries.push({ filePath, sha256 })
        }

        // Diff and sync
        const diff = computeImageDiff(localEntries, apiImages)

        // Delete removed images
        for (const imageId of diff.toDelete) {
          await publisher.edits.images.delete({
            packageName,
            editId,
            language: locale,
            imageType: apiType,
            imageId
          })
        }

        // Upload new images
        for (const filePath of diff.toUpload) {
          const mimeType = filePath.endsWith('.png') ? 'image/png' : 'image/jpeg'
          await publisher.edits.images.upload({
            packageName,
            editId,
            language: locale,
            imageType: apiType,
            media: {
              mimeType,
              body: createReadStream(filePath)
            }
          })
        }
      }
      tracker.completeStep(screenshotStepId)
    }

    // Step: Commit edit
    tracker.startStep('commit')
    await publisher.edits.commit({ packageName, editId })
    tracker.completeStep('commit')

    // Step: Post-commit — update local metadata
    tracker.startStep('post-commit')
    const metadataPath = join(versionDir, 'version_metadata.json')
    try {
      const metaRaw = await readFile(metadataPath, 'utf-8')
      const metadata = JSON.parse(metaRaw)
      metadata.status = 'published'
      await writeFileSafe(metadataPath, JSON.stringify(metadata, null, 2))
    } catch {
      // Non-critical — don't fail the publish
    }
    tracker.completeStep('post-commit')

    tracker.finish()
  } catch (err) {
    // Try to clean up the edit
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

async function writeFileSafe(filePath: string, content: string): Promise<void> {
  const { writeFile: fsWriteFile } = await import('fs/promises')
  await fsWriteFile(filePath, content, 'utf-8')
}
