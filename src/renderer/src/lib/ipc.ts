import type { Settings } from '$shared/types/models'
import type { IpcResult } from '$shared/types/ipc-payloads'

function unwrap<T>(result: IpcResult<T>): T {
  if (!result.success) {
    throw new Error(result.error)
  }
  return result.data
}

export const ipc = {
  async getSettings(): Promise<Settings> {
    return unwrap(await window.api.getSettings())
  },

  async setSettings(partial: Partial<Settings>): Promise<Settings> {
    return unwrap(await window.api.setSettings(partial))
  },

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
  }
}
