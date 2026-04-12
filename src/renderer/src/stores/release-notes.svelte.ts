import { ipc } from '$lib/ipc'
import type { ReleaseNotesConfig, ReleaseNoteEntry, PreflightWarning } from '$shared/types/models'

const RELEASE_NOTES_LIMIT = 500

function joinPath(base: string, ...rest: string[]): string {
  const sep = base.includes('\\') ? '\\' : '/'
  return [base, ...rest].join(sep)
}

function sanitizeVersionName(name: string): string {
  return name.trim().replace(/\s+/g, '_')
}

function emptyConfig(): ReleaseNotesConfig {
  return { versionOrder: [], versions: {} }
}

class ReleaseNotesManagerStore {
  appPath = $state<string | null>(null)
  config = $state<ReleaseNotesConfig | null>(null)
  activeVersionName = $state<string | null>(null)
  entries = $state<ReleaseNoteEntry[]>([])
  loading = $state(false)
  error = $state<string | null>(null)

  releaseNotesRoot = $derived(
    this.appPath ? joinPath(this.appPath, 'release_notes') : null
  )

  versionsDir = $derived(
    this.releaseNotesRoot ? joinPath(this.releaseNotesRoot, 'versions') : null
  )

  activeVersionDir = $derived(
    this.versionsDir && this.activeVersionName
      ? joinPath(this.versionsDir, this.activeVersionName)
      : null
  )

  // --- Initialization ---

  async load(appPath: string): Promise<void> {
    this.appPath = appPath
    this.loading = true
    this.error = null

    try {
      await this.ensureDir()
      await this.loadConfig()

      if (this.config && this.config.versionOrder.length > 0) {
        await this.loadVersionEntries(this.config.versionOrder[0])
      } else {
        this.activeVersionName = null
        this.entries = []
      }
    } catch (err) {
      this.error = String(err)
    } finally {
      this.loading = false
    }
  }

  async reload(): Promise<void> {
    if (!this.appPath) return
    try {
      await this.loadConfig()
      if (this.activeVersionName && this.config?.versionOrder.includes(this.activeVersionName)) {
        await this.loadVersionEntries(this.activeVersionName)
      } else if (this.config && this.config.versionOrder.length > 0) {
        await this.loadVersionEntries(this.config.versionOrder[0])
      } else {
        this.activeVersionName = null
        this.entries = []
      }
    } catch (err) {
      this.error = String(err)
    }
  }

  private async ensureDir(): Promise<void> {
    if (!this.releaseNotesRoot) return
    await ipc.createDirectory(joinPath(this.releaseNotesRoot, 'versions'))
  }

  private async loadConfig(): Promise<void> {
    if (!this.releaseNotesRoot) return
    const configPath = joinPath(this.releaseNotesRoot, 'release_notes_config.json')

    try {
      this.config = (await ipc.readJsonFile(configPath)) as ReleaseNotesConfig
    } catch {
      this.config = emptyConfig()
      await this.saveConfig()
    }
  }

  async loadVersionEntries(versionName: string): Promise<void> {
    if (!this.versionsDir || !this.config) return

    this.activeVersionName = versionName
    const versionDir = joinPath(this.versionsDir, versionName)

    try {
      const dirEntries = await ipc.listDirectory(versionDir)
      const txtFiles = dirEntries
        .filter((e) => !e.isDirectory && e.name.endsWith('.txt'))
        .map((e) => e.name)
        .sort()

      const entries: ReleaseNoteEntry[] = []
      for (const file of txtFiles) {
        const locale = file.replace(/\.txt$/, '')
        try {
          const text = await ipc.readTextFile(joinPath(versionDir, file))
          entries.push({ locale, text, charCount: text.length })
        } catch {
          entries.push({ locale, text: '', charCount: 0 })
        }
      }
      this.entries = entries
    } catch {
      this.entries = []
    }
  }

  // --- Config persistence ---

  private async saveConfig(): Promise<void> {
    if (!this.releaseNotesRoot || !this.config) return
    await ipc.writeJsonFile(
      joinPath(this.releaseNotesRoot, 'release_notes_config.json'),
      $state.snapshot(this.config)
    )
  }

  // --- Version CRUD ---

  async addVersion(name: string): Promise<void> {
    if (!this.versionsDir || !this.config) return

    const sanitized = sanitizeVersionName(name)
    if (!sanitized) return
    if (this.config.versionOrder.includes(sanitized)) {
      this.error = `Version "${sanitized}" already exists`
      return
    }

    try {
      await ipc.createDirectory(joinPath(this.versionsDir, sanitized))

      this.config.versionOrder.unshift(sanitized)
      this.config.versions[sanitized] = {
        createdAt: new Date().toISOString()
      }
      await this.saveConfig()
      await this.loadVersionEntries(sanitized)
    } catch (err) {
      this.error = String(err)
    }
  }

  async duplicateVersion(sourceName: string, newName: string): Promise<void> {
    if (!this.versionsDir || !this.config) return

    const sanitized = sanitizeVersionName(newName)
    if (!sanitized) return
    if (this.config.versionOrder.includes(sanitized)) {
      this.error = `Version "${sanitized}" already exists`
      return
    }

    try {
      await ipc.copyDirectory(
        joinPath(this.versionsDir, sourceName),
        joinPath(this.versionsDir, sanitized)
      )

      const insertIdx = this.config.versionOrder.indexOf(sourceName)
      this.config.versionOrder.splice(insertIdx + 1, 0, sanitized)
      this.config.versions[sanitized] = {
        createdAt: new Date().toISOString()
      }
      await this.saveConfig()
      await this.loadVersionEntries(sanitized)
    } catch (err) {
      this.error = String(err)
    }
  }

  async renameVersion(oldName: string, newName: string): Promise<void> {
    if (!this.versionsDir || !this.config) return

    const sanitized = sanitizeVersionName(newName)
    if (!sanitized) return
    if (this.config.versionOrder.includes(sanitized)) {
      this.error = `Version "${sanitized}" already exists`
      return
    }

    try {
      await ipc.renameItem(
        joinPath(this.versionsDir, oldName),
        joinPath(this.versionsDir, sanitized)
      )

      const idx = this.config.versionOrder.indexOf(oldName)
      this.config.versionOrder[idx] = sanitized
      this.config.versions[sanitized] = this.config.versions[oldName]
      delete this.config.versions[oldName]
      await this.saveConfig()

      if (this.activeVersionName === oldName) {
        await this.loadVersionEntries(sanitized)
      }
    } catch (err) {
      this.error = String(err)
    }
  }

  async deleteVersion(name: string): Promise<void> {
    if (!this.versionsDir || !this.config) return

    try {
      await ipc.deleteToTrash(joinPath(this.versionsDir, name))

      const idx = this.config.versionOrder.indexOf(name)
      this.config.versionOrder.splice(idx, 1)
      delete this.config.versions[name]
      await this.saveConfig()

      if (this.config.versionOrder.length > 0) {
        const nextIdx = Math.min(idx, this.config.versionOrder.length - 1)
        await this.loadVersionEntries(this.config.versionOrder[nextIdx])
      } else {
        this.activeVersionName = null
        this.entries = []
      }
    } catch (err) {
      this.error = String(err)
    }
  }

  // --- Language CRUD ---

  async addLanguage(locale: string): Promise<void> {
    if (!this.activeVersionDir) return

    try {
      await ipc.writeTextFile(joinPath(this.activeVersionDir, `${locale}.txt`), '')
      await this.loadVersionEntries(this.activeVersionName!)
    } catch (err) {
      this.error = String(err)
    }
  }

  async duplicateLanguage(sourceLocale: string, targetLocale: string): Promise<void> {
    if (!this.activeVersionDir) return

    try {
      const sourceText = await ipc.readTextFile(
        joinPath(this.activeVersionDir, `${sourceLocale}.txt`)
      )
      await ipc.writeTextFile(
        joinPath(this.activeVersionDir, `${targetLocale}.txt`),
        sourceText
      )
      await this.loadVersionEntries(this.activeVersionName!)
    } catch (err) {
      this.error = String(err)
    }
  }

  async deleteLanguage(locale: string): Promise<void> {
    if (!this.activeVersionDir) return

    try {
      await ipc.deleteToTrash(joinPath(this.activeVersionDir, `${locale}.txt`))
      await this.loadVersionEntries(this.activeVersionName!)
    } catch (err) {
      this.error = String(err)
    }
  }

  async saveLanguageText(locale: string, text: string): Promise<void> {
    if (!this.activeVersionDir) return

    try {
      await ipc.writeTextFile(joinPath(this.activeVersionDir, `${locale}.txt`), text)
      const entry = this.entries.find((e) => e.locale === locale)
      if (entry) {
        entry.text = text
        entry.charCount = text.length
      }
    } catch (err) {
      this.error = String(err)
    }
  }

  updateEntryText(locale: string, text: string): void {
    const entry = this.entries.find((e) => e.locale === locale)
    if (entry) {
      entry.text = text
      entry.charCount = text.length
    }
  }

  // --- Generate Output ---

  async generateOutput(): Promise<{ output: string; warnings: PreflightWarning[] }> {
    if (!this.versionsDir || !this.config) {
      return { output: '', warnings: [] }
    }

    const warnings: PreflightWarning[] = []
    const allLocales = new Set<string>()

    // Scan all versions to collect all unique locales
    for (const versionName of this.config.versionOrder) {
      const versionDir = joinPath(this.versionsDir, versionName)
      try {
        const dirEntries = await ipc.listDirectory(versionDir)
        for (const entry of dirEntries) {
          if (!entry.isDirectory && entry.name.endsWith('.txt')) {
            allLocales.add(entry.name.replace(/\.txt$/, ''))
          }
        }
      } catch {
        // Skip inaccessible versions
      }
    }

    const sortedLocales = [...allLocales].sort()
    const perLocaleBuffers = new Map<string, string[]>()
    const perLocaleCharCount = new Map<string, number>()

    for (const locale of sortedLocales) {
      perLocaleBuffers.set(locale, [])
      perLocaleCharCount.set(locale, 0)

      for (const versionName of this.config.versionOrder) {
        const filePath = joinPath(this.versionsDir, versionName, `${locale}.txt`)

        let text: string
        try {
          text = (await ipc.readTextFile(filePath)).trim()
        } catch {
          warnings.push({
            locale,
            versionName,
            severity: 'warning',
            message: `${versionName}: missing ${locale} (skipped)`
          })
          continue
        }

        if (!text) continue

        const currentCount = perLocaleCharCount.get(locale) || 0
        const separator = currentCount > 0 ? '\n\n' : ''
        const newCount = currentCount + separator.length + text.length

        if (newCount <= RELEASE_NOTES_LIMIT) {
          perLocaleBuffers.get(locale)!.push(text)
          perLocaleCharCount.set(locale, newCount)
        } else {
          warnings.push({
            locale,
            versionName,
            severity: 'warning',
            message: `Stopped at ${versionName} for ${locale} (would exceed ${RELEASE_NOTES_LIMIT} chars)`
          })
          break
        }
      }
    }

    // Format output in Play Console tag format
    let output = ''
    for (const locale of sortedLocales) {
      const combinedText = perLocaleBuffers.get(locale)?.join('\n\n') || ''
      if (combinedText) {
        output += `<${locale}>\n${combinedText}\n</${locale}>\n`
      }
    }

    return { output: output.trimEnd(), warnings }
  }
}

export const releaseNotesStore = new ReleaseNotesManagerStore()
