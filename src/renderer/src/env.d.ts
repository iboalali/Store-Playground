import type { Settings, AppConfig, AppDetails, AppEntry, VersionEntry, DirectoryEntry, ValidationReport, ProgressEvent, ImportSummary, ReportsIndex, Transaction, AggregationResult } from '$shared/types/models'
import type { IpcResult } from '$shared/types/ipc-payloads'

interface Api {
  // Settings
  getSettings(): Promise<IpcResult<Settings>>
  setSettings(partial: Partial<Settings>): Promise<IpcResult<Settings>>

  // Native dialogs
  openDirectoryDialog(args?: {
    title?: string
    defaultPath?: string
  }): Promise<IpcResult<string | null>>
  openFileDialog(args?: {
    title?: string
    defaultPath?: string
    filters?: Array<{ name: string; extensions: string[] }>
  }): Promise<IpcResult<string | null>>

  // Filesystem
  readWorkspace(args: { workspacePath: string }): Promise<IpcResult<AppEntry[]>>
  readAppConfig(args: { appPath: string }): Promise<IpcResult<AppConfig>>
  createDirectory(args: { dirPath: string }): Promise<IpcResult<void>>
  writeJsonFile(args: { filePath: string; data: unknown }): Promise<IpcResult<void>>
  copyImage(args: { src: string; dest: string }): Promise<IpcResult<void>>
  deleteToTrash(args: { itemPath: string }): Promise<IpcResult<void>>
  createApp(args: {
    workspacePath: string
    appName: string
    packageName: string
  }): Promise<IpcResult<AppEntry>>
  readAppDetails(args: { appPath: string }): Promise<IpcResult<AppDetails>>
  listVersions(args: { appPath: string }): Promise<IpcResult<VersionEntry[]>>
  copyDirectory(args: { src: string; dest: string }): Promise<IpcResult<void>>
  renameItem(args: { oldPath: string; newPath: string }): Promise<IpcResult<void>>
  readTextFile(args: { filePath: string }): Promise<IpcResult<string>>
  writeTextFile(args: { filePath: string; content: string }): Promise<IpcResult<void>>
  listDirectory(args: { dirPath: string }): Promise<IpcResult<DirectoryEntry[]>>
  readJsonFile(args: { filePath: string }): Promise<IpcResult<unknown>>
  writeImageData(args: { destPath: string; base64Data: string }): Promise<IpcResult<void>>

  // Validation
  validateVersion(args: { versionDir: string }): Promise<IpcResult<ValidationReport>>

  // API
  publish(args: {
    packageName: string
    serviceAccountKeyPath: string
    versionDir: string
    appPath: string
  }): Promise<IpcResult<void>>
  importLive(args: {
    packageName: string
    serviceAccountKeyPath: string
    targetDir: string
    mode: string
  }): Promise<IpcResult<void>>
  // Reports
  importCsv(args: { csvPath: string; workspacePath: string }): Promise<IpcResult<ImportSummary>>
  getReportsIndex(args: { workspacePath: string }): Promise<IpcResult<ReportsIndex>>
  getReportsMonth(args: { workspacePath: string; monthKey: string }): Promise<IpcResult<Transaction[]>>
  getReportsAggregation(args: {
    workspacePath: string
    monthKeys: string[]
    appPackageName?: string
  }): Promise<IpcResult<AggregationResult>>
  deleteReportsMonth(args: { workspacePath: string; monthKey: string }): Promise<IpcResult<void>>

  onApiProgress(callback: (event: ProgressEvent) => void): () => void
  onWatcherChange(callback: () => void): () => void
  onMenuAction(callback: (action: string) => void): () => void
}

declare global {
  interface Window {
    api: Api
    electron: typeof import('@electron-toolkit/preload').electronAPI
  }
}
