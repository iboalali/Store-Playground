import { ipc } from '$lib/ipc'
import type { LocaleTextFields, ScreenshotType, ScreenshotGroup, ValidationReport } from '$shared/types/models'

function joinPath(base: string, ...rest: string[]): string {
  const sep = base.includes('\\') ? '\\' : '/'
  return [base, ...rest].join(sep)
}

export const TEXT_FILE_MAP: { key: keyof LocaleTextFields; fileName: string; maxLength: number }[] = [
  { key: 'title', fileName: 'title.txt', maxLength: 30 },
  { key: 'shortDescription', fileName: 'short_description.txt', maxLength: 80 },
  { key: 'fullDescription', fileName: 'full_description.txt', maxLength: 4000 },
  { key: 'videoUrl', fileName: 'video_url.txt', maxLength: 0 }
]

export const SCREENSHOT_TYPES: ScreenshotType[] = ['phone', 'tablet_7', 'tablet_10', 'chromebook', 'tv', 'wear', 'android_xr']

export const IMAGE_FILES = [
  { key: 'icon', fileName: 'high_res_icon.png', label: 'High Res Icon', dimensions: '512x512' },
  { key: 'featureGraphic', fileName: 'feature_graphic.png', label: 'Feature Graphic', dimensions: '1024x500' },
  { key: 'tvBanner', fileName: 'tv_banner.png', label: 'TV Banner', dimensions: '1280x720' }
] as const

export const SCREENSHOT_LABELS: Record<ScreenshotType, string> = {
  phone: 'Phone',
  tablet_7: '7" Tablet',
  tablet_10: '10" Tablet',
  chromebook: 'Desktop / Chromebook',
  tv: 'TV',
  wear: 'Wear',
  android_xr: 'Android XR'
}

const KNOWN_NON_LOCALE = new Set(['version_metadata.json', 'screenshots', '.DS_Store', 'Thumbs.db'])

function emptyTexts(): LocaleTextFields {
  return { title: '', shortDescription: '', fullDescription: '', videoUrl: '' }
}

class EditorStore {
  appPath = $state<string | null>(null)
  versionDir = $state<string | null>(null)

  locales = $state<string[]>([])
  activeLocale = $state<string | null>(null)

  texts = $state<LocaleTextFields>(emptyTexts())
  savedTexts = $state<LocaleTextFields>(emptyTexts())

  images = $state<Record<string, { filePath: string; exists: boolean }>>({})
  screenshotGroups = $state<ScreenshotGroup[]>([])

  loading = $state(false)
  saving = $state(false)
  validating = $state(false)
  error = $state<string | null>(null)
  imageTimestamp = $state(Date.now())
  validationReport = $state<ValidationReport | null>(null)

  versionPath = $derived(
    this.appPath && this.versionDir ? joinPath(this.appPath, this.versionDir) : null
  )

  localePath = $derived(
    this.versionPath && this.activeLocale ? joinPath(this.versionPath, this.activeLocale) : null
  )

  isDirty = $derived(
    this.texts.title !== this.savedTexts.title ||
    this.texts.shortDescription !== this.savedTexts.shortDescription ||
    this.texts.fullDescription !== this.savedTexts.fullDescription ||
    this.texts.videoUrl !== this.savedTexts.videoUrl
  )

  charCounts = $derived({
    title: this.texts.title.length,
    shortDescription: this.texts.shortDescription.length,
    fullDescription: this.texts.fullDescription.length
  })

  localeErrors = $derived.by(() => {
    if (!this.validationReport || !this.activeLocale) return {}
    const errors: Record<string, string> = {}
    const allIssues = [...this.validationReport.errors, ...this.validationReport.warnings]
    for (const issue of allIssues) {
      if (issue.locale === this.activeLocale && !errors[issue.field]) {
        errors[issue.field] = issue.message
      }
    }
    return errors
  })

  async load(appPath: string, versionDir: string): Promise<void> {
    this.appPath = appPath
    this.versionDir = versionDir
    this.loading = true
    this.error = null

    try {
      await this.loadLocales()
      if (this.locales.length > 0) {
        await this.loadLocaleData(this.locales[0])
      } else {
        this.activeLocale = null
        this.texts = emptyTexts()
        this.savedTexts = emptyTexts()
        this.images = {}
        this.screenshotGroups = []
      }
    } catch (err) {
      this.error = String(err)
    } finally {
      this.loading = false
    }
  }

  async reload(): Promise<void> {
    if (!this.appPath || !this.versionDir) return
    try {
      await this.loadLocales()
      if (this.activeLocale && this.locales.includes(this.activeLocale)) {
        await Promise.all([this.loadTexts(), this.loadImages(), this.loadScreenshots()])
      } else if (this.locales.length > 0) {
        await this.loadLocaleData(this.locales[0])
      }
    } catch (err) {
      this.error = String(err)
    }
  }

  async loadLocales(): Promise<void> {
    if (!this.versionPath) return
    try {
      const entries = await ipc.listDirectory(this.versionPath)
      this.locales = entries
        .filter((e) => e.isDirectory && !KNOWN_NON_LOCALE.has(e.name))
        .map((e) => e.name)
        .sort()
    } catch {
      this.locales = []
    }
  }

  async loadLocaleData(locale: string): Promise<void> {
    this.activeLocale = locale
    this.error = null

    try {
      await Promise.all([this.loadTexts(), this.loadImages(), this.loadScreenshots()])
    } catch (err) {
      this.error = String(err)
    }
  }

  async loadTexts(): Promise<void> {
    if (!this.localePath) return

    const loaded = emptyTexts()
    for (const field of TEXT_FILE_MAP) {
      try {
        loaded[field.key] = await ipc.readTextFile(joinPath(this.localePath, field.fileName))
      } catch {
        loaded[field.key] = ''
      }
    }
    this.texts = { ...loaded }
    this.savedTexts = { ...loaded }
  }

  async loadImages(): Promise<void> {
    if (!this.localePath) return

    let dirEntries: string[] = []
    try {
      const entries = await ipc.listDirectory(this.localePath)
      dirEntries = entries.filter((e) => !e.isDirectory).map((e) => e.name)
    } catch {
      dirEntries = []
    }

    const result: Record<string, { filePath: string; exists: boolean }> = {}
    for (const img of IMAGE_FILES) {
      result[img.key] = {
        filePath: joinPath(this.localePath, img.fileName),
        exists: dirEntries.includes(img.fileName)
      }
    }
    this.images = result
  }

  async loadScreenshots(): Promise<void> {
    if (!this.localePath) return

    const groups: ScreenshotGroup[] = []
    const screenshotsDir = joinPath(this.localePath, 'screenshots')

    for (const type of SCREENSHOT_TYPES) {
      const typeDir = joinPath(screenshotsDir, type)
      try {
        const entries = await ipc.listDirectory(typeDir)
        const screenshots = entries
          .filter((e) => !e.isDirectory && /\.(png|jpg|jpeg)$/i.test(e.name))
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((e) => ({ fileName: e.name, filePath: joinPath(typeDir, e.name) }))
        groups.push({ type, dirPath: typeDir, screenshots })
      } catch {
        groups.push({ type, dirPath: typeDir, screenshots: [] })
      }
    }
    this.screenshotGroups = groups
  }

  async switchLocale(locale: string): Promise<void> {
    if (locale === this.activeLocale) return

    if (this.isDirty) {
      await this.saveTexts()
    }

    this.loading = true
    try {
      await this.loadLocaleData(locale)
    } finally {
      this.loading = false
    }
  }

  async saveTexts(): Promise<void> {
    if (!this.localePath) return
    this.saving = true

    try {
      for (const field of TEXT_FILE_MAP) {
        if (this.texts[field.key] !== this.savedTexts[field.key]) {
          await ipc.writeTextFile(
            joinPath(this.localePath, field.fileName),
            this.texts[field.key]
          )
        }
      }
      this.savedTexts = { ...this.texts }
      this.error = null
    } catch (err) {
      this.error = String(err)
    } finally {
      this.saving = false
    }
  }

  async validateVersion(): Promise<ValidationReport | null> {
    if (!this.versionPath) return null
    this.validating = true
    try {
      this.validationReport = await ipc.validateVersion(this.versionPath)
      return this.validationReport
    } catch (err) {
      this.error = String(err)
      return null
    } finally {
      this.validating = false
    }
  }

  async addImage(key: string, sourcePath: string): Promise<void> {
    if (!this.localePath) return
    const imgDef = IMAGE_FILES.find((i) => i.key === key)
    if (!imgDef) return

    try {
      await ipc.copyImage(sourcePath, joinPath(this.localePath, imgDef.fileName))
      this.imageTimestamp = Date.now()
      await this.loadImages()
    } catch (err) {
      this.error = String(err)
    }
  }

  async addImageFromClipboard(key: string, base64Data: string): Promise<void> {
    if (!this.localePath) return
    const imgDef = IMAGE_FILES.find((i) => i.key === key)
    if (!imgDef) return

    try {
      await ipc.writeImageData(joinPath(this.localePath, imgDef.fileName), base64Data)
      this.imageTimestamp = Date.now()
      await this.loadImages()
    } catch (err) {
      this.error = String(err)
    }
  }

  async deleteImage(key: string): Promise<void> {
    if (!this.localePath) return
    const imgDef = IMAGE_FILES.find((i) => i.key === key)
    if (!imgDef) return

    try {
      await ipc.deleteToTrash(joinPath(this.localePath, imgDef.fileName))
      this.imageTimestamp = Date.now()
      await this.loadImages()
    } catch (err) {
      this.error = String(err)
    }
  }

  async addScreenshot(type: ScreenshotType, sourcePath: string): Promise<void> {
    if (!this.localePath) return

    const screenshotsDir = joinPath(this.localePath, 'screenshots')
    const typeDir = joinPath(screenshotsDir, type)

    try {
      await ipc.createDirectory(typeDir)

      const group = this.screenshotGroups.find((g) => g.type === type)
      const count = group ? group.screenshots.length : 0
      const ext = sourcePath.split('.').pop()?.toLowerCase() || 'png'
      const nextNum = String(count + 1).padStart(2, '0')
      const destName = `${nextNum}.${ext}`

      await ipc.copyImage(sourcePath, joinPath(typeDir, destName))
      this.imageTimestamp = Date.now()
      await this.loadScreenshots()
    } catch (err) {
      this.error = String(err)
    }
  }

  async addScreenshotFromClipboard(type: ScreenshotType, base64Data: string): Promise<void> {
    if (!this.localePath) return

    const screenshotsDir = joinPath(this.localePath, 'screenshots')
    const typeDir = joinPath(screenshotsDir, type)

    try {
      await ipc.createDirectory(typeDir)

      const group = this.screenshotGroups.find((g) => g.type === type)
      const count = group ? group.screenshots.length : 0
      const nextNum = String(count + 1).padStart(2, '0')
      const destName = `${nextNum}.png`

      await ipc.writeImageData(joinPath(typeDir, destName), base64Data)
      this.imageTimestamp = Date.now()
      await this.loadScreenshots()
    } catch (err) {
      this.error = String(err)
    }
  }

  async deleteScreenshot(type: ScreenshotType, fileName: string): Promise<void> {
    if (!this.localePath) return

    const typeDir = joinPath(this.localePath, 'screenshots', type)

    try {
      await ipc.deleteToTrash(joinPath(typeDir, fileName))

      // Renumber remaining files (two-pass to avoid collisions)
      const group = this.screenshotGroups.find((g) => g.type === type)
      if (group) {
        const remaining = group.screenshots
          .filter((s) => s.fileName !== fileName)
          .sort((a, b) => a.fileName.localeCompare(b.fileName))

        // Pass 1: rename to temp names
        for (let i = 0; i < remaining.length; i++) {
          const ext = remaining[i].fileName.split('.').pop() || 'png'
          const tmpName = `_tmp_${String(i + 1).padStart(2, '0')}.${ext}`
          await ipc.renameItem(
            joinPath(typeDir, remaining[i].fileName),
            joinPath(typeDir, tmpName)
          )
        }

        // Pass 2: rename to final names
        for (let i = 0; i < remaining.length; i++) {
          const ext = remaining[i].fileName.split('.').pop() || 'png'
          const tmpName = `_tmp_${String(i + 1).padStart(2, '0')}.${ext}`
          const finalName = `${String(i + 1).padStart(2, '0')}.${ext}`
          await ipc.renameItem(joinPath(typeDir, tmpName), joinPath(typeDir, finalName))
        }
      }

      this.imageTimestamp = Date.now()
      await this.loadScreenshots()
    } catch (err) {
      this.error = String(err)
    }
  }

  async reorderScreenshots(type: ScreenshotType, orderedFileNames: string[]): Promise<void> {
    if (!this.localePath) return

    const typeDir = joinPath(this.localePath, 'screenshots', type)

    try {
      // Pass 1: rename all to temp names
      for (let i = 0; i < orderedFileNames.length; i++) {
        const ext = orderedFileNames[i].split('.').pop() || 'png'
        const tmpName = `_tmp_${String(i + 1).padStart(2, '0')}.${ext}`
        await ipc.renameItem(
          joinPath(typeDir, orderedFileNames[i]),
          joinPath(typeDir, tmpName)
        )
      }

      // Pass 2: rename to final names
      for (let i = 0; i < orderedFileNames.length; i++) {
        const ext = orderedFileNames[i].split('.').pop() || 'png'
        const tmpName = `_tmp_${String(i + 1).padStart(2, '0')}.${ext}`
        const finalName = `${String(i + 1).padStart(2, '0')}.${ext}`
        await ipc.renameItem(joinPath(typeDir, tmpName), joinPath(typeDir, finalName))
      }

      this.imageTimestamp = Date.now()
      await this.loadScreenshots()
    } catch (err) {
      this.error = String(err)
    }
  }

  async addLocale(localeTag: string): Promise<void> {
    if (!this.versionPath) return

    try {
      if (this.isDirty) {
        await this.saveTexts()
      }

      const localePath = joinPath(this.versionPath, localeTag)
      await ipc.createDirectory(localePath)

      // Create empty text files
      for (const field of TEXT_FILE_MAP) {
        await ipc.writeTextFile(joinPath(localePath, field.fileName), '')
      }

      // Create screenshot subdirectories
      const screenshotsDir = joinPath(localePath, 'screenshots')
      for (const type of SCREENSHOT_TYPES) {
        await ipc.createDirectory(joinPath(screenshotsDir, type))
      }

      await this.loadLocales()
      await this.loadLocaleData(localeTag)
    } catch (err) {
      this.error = String(err)
    }
  }

  async duplicateLocale(sourceLocale: string, targetLocale: string): Promise<void> {
    if (!this.versionPath) return

    try {
      if (this.isDirty) {
        await this.saveTexts()
      }

      await ipc.copyDirectory(
        joinPath(this.versionPath, sourceLocale),
        joinPath(this.versionPath, targetLocale)
      )

      await this.loadLocales()
      await this.loadLocaleData(targetLocale)
    } catch (err) {
      this.error = String(err)
    }
  }

  async deleteLocale(localeTag: string): Promise<void> {
    if (!this.versionPath) return

    try {
      await ipc.deleteToTrash(joinPath(this.versionPath, localeTag))

      await this.loadLocales()
      if (this.locales.length > 0) {
        const nextLocale = this.locales[0]
        await this.loadLocaleData(nextLocale)
      } else {
        this.activeLocale = null
        this.texts = emptyTexts()
        this.savedTexts = emptyTexts()
        this.images = {}
        this.screenshotGroups = []
      }
    } catch (err) {
      this.error = String(err)
    }
  }
}

export const editorStore = new EditorStore()
