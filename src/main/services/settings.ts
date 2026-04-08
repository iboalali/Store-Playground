import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import type { Settings } from '$shared/types/models'

const DEFAULT_SETTINGS: Settings = {
  workspacePath: null,
  serviceAccountKeyPath: null
}

const SETTINGS_FILENAME = 'settings.json'

export class SettingsService {
  private filePath: string
  private cache: Settings | null = null

  constructor(userDataPath: string) {
    this.filePath = join(userDataPath, SETTINGS_FILENAME)
  }

  async get(): Promise<Settings> {
    if (this.cache) return this.cache
    try {
      const raw = await readFile(this.filePath, 'utf-8')
      const parsed = JSON.parse(raw) as Partial<Settings>
      this.cache = { ...DEFAULT_SETTINGS, ...parsed }
      return this.cache
    } catch {
      // File doesn't exist on first launch — return defaults
      this.cache = { ...DEFAULT_SETTINGS }
      return this.cache
    }
  }

  async set(partial: Partial<Settings>): Promise<Settings> {
    const current = await this.get()
    const updated = { ...current, ...partial }
    await mkdir(dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, JSON.stringify(updated, null, 2), 'utf-8')
    this.cache = updated
    return updated
  }

  async reset(): Promise<void> {
    const defaults = { ...DEFAULT_SETTINGS }
    await mkdir(dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, JSON.stringify(defaults, null, 2), 'utf-8')
    this.cache = defaults
  }
}
