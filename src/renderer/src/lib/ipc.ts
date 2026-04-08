import type { Settings, AppConfig, AppDetails, AppEntry, VersionEntry, DirectoryEntry, ValidationReport, ProgressEvent, ImportSummary, ReportsIndex, Transaction, AggregationResult } from '$shared/types/models'
import type { IpcResult } from '$shared/types/ipc-payloads'

function unwrap<T>(result: IpcResult<T>): T {
  if (!result.success) {
    throw new Error(result.error)
  }
  return result.data
}

export const ipc = {
  // Settings
  async getSettings(): Promise<Settings> {
    return unwrap(await window.api.getSettings())
  },

  async setSettings(partial: Partial<Settings>): Promise<Settings> {
    return unwrap(await window.api.setSettings(partial))
  },

  // Native dialogs
  async openDirectoryDialog(args?: {
    title?: string
    defaultPath?: string
  }): Promise<string | null> {
    return unwrap(await window.api.openDirectoryDialog(args))
  },

  async openFileDialog(args?: {
    title?: string
    defaultPath?: string
    filters?: Array<{ name: string; extensions: string[] }>
  }): Promise<string | null> {
    return unwrap(await window.api.openFileDialog(args))
  },

  // Filesystem
  async readWorkspace(workspacePath: string): Promise<AppEntry[]> {
    return unwrap(await window.api.readWorkspace({ workspacePath }))
  },

  async readAppConfig(appPath: string): Promise<AppConfig> {
    return unwrap(await window.api.readAppConfig({ appPath }))
  },

  async createDirectory(dirPath: string): Promise<void> {
    return unwrap(await window.api.createDirectory({ dirPath }))
  },

  async writeJsonFile(filePath: string, data: unknown): Promise<void> {
    return unwrap(await window.api.writeJsonFile({ filePath, data }))
  },

  async copyImage(src: string, dest: string): Promise<void> {
    return unwrap(await window.api.copyImage({ src, dest }))
  },

  async deleteToTrash(itemPath: string): Promise<void> {
    return unwrap(await window.api.deleteToTrash({ itemPath }))
  },

  async createApp(args: {
    workspacePath: string
    appName: string
    packageName: string
  }): Promise<AppEntry> {
    return unwrap(await window.api.createApp(args))
  },

  async readAppDetails(appPath: string): Promise<AppDetails> {
    return unwrap(await window.api.readAppDetails({ appPath }))
  },

  async listVersions(appPath: string): Promise<VersionEntry[]> {
    return unwrap(await window.api.listVersions({ appPath }))
  },

  async copyDirectory(src: string, dest: string): Promise<void> {
    return unwrap(await window.api.copyDirectory({ src, dest }))
  },

  async renameItem(oldPath: string, newPath: string): Promise<void> {
    return unwrap(await window.api.renameItem({ oldPath, newPath }))
  },

  async readTextFile(filePath: string): Promise<string> {
    return unwrap(await window.api.readTextFile({ filePath }))
  },

  async writeTextFile(filePath: string, content: string): Promise<void> {
    return unwrap(await window.api.writeTextFile({ filePath, content }))
  },

  async listDirectory(dirPath: string): Promise<DirectoryEntry[]> {
    return unwrap(await window.api.listDirectory({ dirPath }))
  },

  async readJsonFile(filePath: string): Promise<unknown> {
    return unwrap(await window.api.readJsonFile({ filePath }))
  },

  async writeImageData(destPath: string, base64Data: string): Promise<void> {
    return unwrap(await window.api.writeImageData({ destPath, base64Data }))
  },

  // Validation
  async validateVersion(versionDir: string): Promise<ValidationReport> {
    return unwrap(await window.api.validateVersion({ versionDir }))
  },

  // API
  async publish(args: {
    packageName: string
    serviceAccountKeyPath: string
    versionDir: string
    appPath: string
  }): Promise<void> {
    return unwrap(await window.api.publish(args))
  },

  async importLive(args: {
    packageName: string
    serviceAccountKeyPath: string
    targetDir: string
    mode: string
  }): Promise<void> {
    return unwrap(await window.api.importLive(args))
  },

  // Reports
  async importCsv(csvPath: string, workspacePath: string): Promise<ImportSummary> {
    return unwrap(await window.api.importCsv({ csvPath, workspacePath }))
  },

  async getReportsIndex(workspacePath: string): Promise<ReportsIndex> {
    return unwrap(await window.api.getReportsIndex({ workspacePath }))
  },

  async getReportsMonth(workspacePath: string, monthKey: string): Promise<Transaction[]> {
    return unwrap(await window.api.getReportsMonth({ workspacePath, monthKey }))
  },

  async getReportsAggregation(
    workspacePath: string,
    monthKeys: string[],
    appPackageName?: string
  ): Promise<AggregationResult> {
    return unwrap(
      await window.api.getReportsAggregation({ workspacePath, monthKeys, appPackageName })
    )
  },

  async deleteReportsMonth(workspacePath: string, monthKey: string): Promise<void> {
    return unwrap(await window.api.deleteReportsMonth({ workspacePath, monthKey }))
  },

  onApiProgress(callback: (event: ProgressEvent) => void): () => void {
    return window.api.onApiProgress(callback)
  },

  onWatcherChange(callback: () => void): () => void {
    return window.api.onWatcherChange(callback)
  },

  onMenuAction(callback: (action: string) => void): () => void {
    return window.api.onMenuAction(callback)
  }
}
