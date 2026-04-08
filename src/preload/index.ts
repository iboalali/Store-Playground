import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  SETTINGS_GET,
  SETTINGS_SET,
  SETTINGS_RESET_ALL,
  DIALOG_OPEN_DIRECTORY,
  DIALOG_OPEN_FILE,
  FS_READ_WORKSPACE,
  FS_READ_APP_CONFIG,
  FS_CREATE_DIRECTORY,
  FS_WRITE_JSON_FILE,
  FS_COPY_IMAGE,
  FS_DELETE_TO_TRASH,
  FS_CREATE_APP,
  FS_READ_APP_DETAILS,
  FS_LIST_VERSIONS,
  FS_COPY_DIRECTORY,
  FS_RENAME_ITEM,
  FS_READ_TEXT_FILE,
  FS_WRITE_TEXT_FILE,
  FS_LIST_DIRECTORY,
  FS_READ_JSON_FILE,
  FS_WRITE_IMAGE_DATA,
  VALIDATION_VALIDATE_VERSION,
  API_PUBLISH,
  API_IMPORT_LIVE,
  API_PROGRESS,
  REPORTS_IMPORT_CSV,
  REPORTS_GET_INDEX,
  REPORTS_GET_MONTH,
  REPORTS_GET_AGGREGATION,
  REPORTS_DELETE_MONTH,
  WATCHER_CHANGE,
  MENU_ACTION
} from '$shared/types/ipc-channels'

contextBridge.exposeInMainWorld('electron', electronAPI)

contextBridge.exposeInMainWorld('api', {
  // Settings
  getSettings: () => ipcRenderer.invoke(SETTINGS_GET),
  setSettings: (partial: Record<string, unknown>) => ipcRenderer.invoke(SETTINGS_SET, partial),
  resetAll: () => ipcRenderer.invoke(SETTINGS_RESET_ALL),

  // Native dialogs
  openDirectoryDialog: (args?: { title?: string; defaultPath?: string }) =>
    ipcRenderer.invoke(DIALOG_OPEN_DIRECTORY, args),
  openFileDialog: (
    args?: {
      title?: string
      defaultPath?: string
      filters?: Array<{ name: string; extensions: string[] }>
    }
  ) => ipcRenderer.invoke(DIALOG_OPEN_FILE, args),

  // Filesystem
  readWorkspace: (args: { workspacePath: string }) =>
    ipcRenderer.invoke(FS_READ_WORKSPACE, args),
  readAppConfig: (args: { appPath: string }) =>
    ipcRenderer.invoke(FS_READ_APP_CONFIG, args),
  createDirectory: (args: { dirPath: string }) =>
    ipcRenderer.invoke(FS_CREATE_DIRECTORY, args),
  writeJsonFile: (args: { filePath: string; data: unknown }) =>
    ipcRenderer.invoke(FS_WRITE_JSON_FILE, args),
  copyImage: (args: { src: string; dest: string }) =>
    ipcRenderer.invoke(FS_COPY_IMAGE, args),
  deleteToTrash: (args: { itemPath: string }) =>
    ipcRenderer.invoke(FS_DELETE_TO_TRASH, args),
  createApp: (args: { workspacePath: string; appName: string; packageName: string }) =>
    ipcRenderer.invoke(FS_CREATE_APP, args),
  readAppDetails: (args: { appPath: string }) =>
    ipcRenderer.invoke(FS_READ_APP_DETAILS, args),
  listVersions: (args: { appPath: string }) =>
    ipcRenderer.invoke(FS_LIST_VERSIONS, args),
  copyDirectory: (args: { src: string; dest: string }) =>
    ipcRenderer.invoke(FS_COPY_DIRECTORY, args),
  renameItem: (args: { oldPath: string; newPath: string }) =>
    ipcRenderer.invoke(FS_RENAME_ITEM, args),
  readTextFile: (args: { filePath: string }) =>
    ipcRenderer.invoke(FS_READ_TEXT_FILE, args),
  writeTextFile: (args: { filePath: string; content: string }) =>
    ipcRenderer.invoke(FS_WRITE_TEXT_FILE, args),
  listDirectory: (args: { dirPath: string }) =>
    ipcRenderer.invoke(FS_LIST_DIRECTORY, args),
  readJsonFile: (args: { filePath: string }) =>
    ipcRenderer.invoke(FS_READ_JSON_FILE, args),
  writeImageData: (args: { destPath: string; base64Data: string }) =>
    ipcRenderer.invoke(FS_WRITE_IMAGE_DATA, args),

  // Validation
  validateVersion: (args: { versionDir: string }) =>
    ipcRenderer.invoke(VALIDATION_VALIDATE_VERSION, args),

  // API
  publish: (args: {
    packageName: string
    serviceAccountKeyPath: string
    versionDir: string
    appPath: string
  }) => ipcRenderer.invoke(API_PUBLISH, args),
  importLive: (args: {
    packageName: string
    serviceAccountKeyPath: string
    targetDir: string
    mode: string
  }) => ipcRenderer.invoke(API_IMPORT_LIVE, args),
  onApiProgress: (callback: (...args: unknown[]) => void) => {
    const handler = (_ipcEvent: unknown, data: unknown): void => callback(data)
    ipcRenderer.on(API_PROGRESS, handler as Parameters<typeof ipcRenderer.on>[1])
    return (): void => {
      ipcRenderer.removeListener(API_PROGRESS, handler as Parameters<typeof ipcRenderer.removeListener>[1])
    }
  },

  // Reports
  importCsv: (args: { csvPath: string; workspacePath: string }) =>
    ipcRenderer.invoke(REPORTS_IMPORT_CSV, args),
  getReportsIndex: (args: { workspacePath: string }) =>
    ipcRenderer.invoke(REPORTS_GET_INDEX, args),
  getReportsMonth: (args: { workspacePath: string; monthKey: string }) =>
    ipcRenderer.invoke(REPORTS_GET_MONTH, args),
  getReportsAggregation: (args: {
    workspacePath: string
    monthKeys: string[]
    appPackageName?: string
  }) => ipcRenderer.invoke(REPORTS_GET_AGGREGATION, args),
  deleteReportsMonth: (args: { workspacePath: string; monthKey: string }) =>
    ipcRenderer.invoke(REPORTS_DELETE_MONTH, args),

  // Watcher events
  onWatcherChange: (callback: (...args: unknown[]) => void) => {
    const handler = (): void => callback()
    ipcRenderer.on(WATCHER_CHANGE, handler as Parameters<typeof ipcRenderer.on>[1])
    return (): void => {
      ipcRenderer.removeListener(WATCHER_CHANGE, handler as Parameters<typeof ipcRenderer.removeListener>[1])
    }
  },

  // Menu action events
  onMenuAction: (callback: (...args: unknown[]) => void) => {
    const handler = (_ipcEvent: unknown, action: unknown): void => callback(action)
    ipcRenderer.on(MENU_ACTION, handler as Parameters<typeof ipcRenderer.on>[1])
    return (): void => {
      ipcRenderer.removeListener(MENU_ACTION, handler as Parameters<typeof ipcRenderer.removeListener>[1])
    }
  }
})
