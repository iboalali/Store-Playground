import type { Settings, AppConfig, AppEntry } from '$shared/types/models'
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
  }
}
