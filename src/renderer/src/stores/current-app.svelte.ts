import { ipc } from '$lib/ipc'
import { goHome } from '../router.svelte'
import type { AppConfig, AppDetails, VersionEntry, VersionMetadata, ValidationReport } from '$shared/types/models'

function joinPath(base: string, ...rest: string[]): string {
  const sep = base.includes('\\') ? '\\' : '/'
  return [base, ...rest].join(sep)
}

class CurrentAppStore {
  appPath = $state<string | null>(null)
  config = $state<AppConfig | null>(null)
  details = $state<AppDetails | null>(null)
  versions = $state<VersionEntry[]>([])
  loading = $state(false)
  error = $state<string | null>(null)
  showArchived = $state(false)
  validationResults = $state<Record<string, ValidationReport>>({})
  validatingVersion = $state<string | null>(null)

  liveVersion = $derived(this.versions.find((v) => v.isLive) ?? null)

  historicalVersions = $derived(this.versions.filter((v) => !v.isLive))

  visibleVersions = $derived(
    this.showArchived
      ? this.versions
      : this.versions.filter((v) => v.metadata.status !== 'archived')
  )

  async load(appPath: string): Promise<void> {
    this.appPath = appPath
    this.loading = true
    this.error = null
    try {
      const [config, details, versions] = await Promise.all([
        ipc.readAppConfig(appPath),
        ipc.readAppDetails(appPath),
        ipc.listVersions(appPath)
      ])
      this.config = config
      this.details = details
      this.versions = versions
    } catch (err) {
      this.error = String(err)
    } finally {
      this.loading = false
    }
  }

  async refresh(): Promise<void> {
    if (!this.appPath) return
    await this.load(this.appPath)
  }

  async saveDetails(details: AppDetails): Promise<void> {
    if (!this.appPath) return
    try {
      await ipc.writeJsonFile(joinPath(this.appPath, 'app_details.json'), $state.snapshot(details))
      this.details = details
      this.error = null
    } catch (err) {
      this.error = String(err)
    }
  }

  async saveConfig(partial: Partial<AppConfig>): Promise<void> {
    if (!this.appPath || !this.config) return
    try {
      const updated = { ...this.config, ...partial }
      await ipc.writeJsonFile(joinPath(this.appPath, 'app_config.json'), $state.snapshot(updated))
      this.config = updated
      await this.refresh()
    } catch (err) {
      this.error = String(err)
    }
  }

  async createNewListing(): Promise<void> {
    if (!this.appPath) return
    try {
      const now = new Date()
      const timestamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 15)
      const newDirName = `listing_${timestamp}`
      const newDirPath = joinPath(this.appPath, newDirName)

      if (this.liveVersion) {
        await ipc.copyDirectory(this.liveVersion.dirPath, newDirPath)
        // Update metadata to draft
        const meta: VersionMetadata = {
          createdAt: now.toISOString(),
          status: 'draft',
          customNotes: ''
        }
        await ipc.writeJsonFile(joinPath(newDirPath, 'version_metadata.json'), meta)
      } else {
        await ipc.createDirectory(newDirPath)
        const meta: VersionMetadata = {
          createdAt: now.toISOString(),
          status: 'draft',
          customNotes: ''
        }
        await ipc.writeJsonFile(joinPath(newDirPath, 'version_metadata.json'), meta)
      }

      await this.saveConfig({ liveVersionDir: newDirName })
    } catch (err) {
      this.error = String(err)
    }
  }

  async duplicateListing(versionDirName: string, newName: string): Promise<void> {
    if (!this.appPath) return
    try {
      const src = joinPath(this.appPath, versionDirName)
      const dest = joinPath(this.appPath, newName)
      await ipc.copyDirectory(src, dest)

      const meta: VersionMetadata = {
        createdAt: new Date().toISOString(),
        status: 'draft',
        customNotes: ''
      }
      await ipc.writeJsonFile(joinPath(dest, 'version_metadata.json'), meta)
      await this.refresh()
    } catch (err) {
      this.error = String(err)
    }
  }

  async renameListing(versionDirName: string, newName: string): Promise<void> {
    if (!this.appPath) return
    try {
      const oldPath = joinPath(this.appPath, versionDirName)
      const newPath = joinPath(this.appPath, newName)
      await ipc.renameItem(oldPath, newPath)

      if (this.config?.liveVersionDir === versionDirName) {
        await this.saveConfig({ liveVersionDir: newName })
      } else {
        await this.refresh()
      }
    } catch (err) {
      this.error = String(err)
    }
  }

  async deleteListing(versionDirName: string): Promise<void> {
    if (!this.appPath) return
    try {
      const dirPath = joinPath(this.appPath, versionDirName)
      await ipc.deleteToTrash(dirPath)

      if (this.config?.liveVersionDir === versionDirName) {
        // Reassign to newest non-archived version
        const remaining = this.versions.filter(
          (v) => v.dirName !== versionDirName && v.metadata.status !== 'archived'
        )
        const newLive = remaining.length > 0 ? remaining[0].dirName : null
        await this.saveConfig({ liveVersionDir: newLive })
      } else {
        await this.refresh()
      }
    } catch (err) {
      this.error = String(err)
    }
  }

  async archiveListing(versionDirName: string): Promise<void> {
    if (!this.appPath) return
    try {
      const version = this.versions.find((v) => v.dirName === versionDirName)
      if (!version) return

      const updatedMeta: VersionMetadata = {
        ...version.metadata,
        status: 'archived'
      }
      await ipc.writeJsonFile(
        joinPath(this.appPath, versionDirName, 'version_metadata.json'),
        $state.snapshot(updatedMeta)
      )
      await this.refresh()
    } catch (err) {
      this.error = String(err)
    }
  }

  async validateVersion(dirName: string): Promise<ValidationReport | null> {
    const version = this.versions.find((v) => v.dirName === dirName)
    if (!version) return null
    this.validatingVersion = dirName
    try {
      const report = await ipc.validateVersion(version.dirPath)
      this.validationResults[dirName] = report
      return report
    } catch (err) {
      this.error = String(err)
      return null
    } finally {
      this.validatingVersion = null
    }
  }

  async deleteApp(): Promise<void> {
    if (!this.appPath) return
    try {
      await ipc.deleteToTrash(this.appPath)
      this.appPath = null
      this.config = null
      this.details = null
      this.versions = []
      goHome()
    } catch (err) {
      this.error = String(err)
    }
  }
}

export const currentAppStore = new CurrentAppStore()
