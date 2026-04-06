import type { Settings } from '$shared/types/models'
import type { IpcResult } from '$shared/types/ipc-payloads'

interface Api {
  getSettings(): Promise<IpcResult<Settings>>
  setSettings(partial: Partial<Settings>): Promise<IpcResult<Settings>>
  openDirectoryDialog(args?: {
    title?: string
    defaultPath?: string
  }): Promise<IpcResult<string | null>>
  openFileDialog(args?: {
    title?: string
    defaultPath?: string
    filters?: Array<{ name: string; extensions: string[] }>
  }): Promise<IpcResult<string | null>>
}

declare global {
  interface Window {
    api: Api
    electron: typeof import('@electron-toolkit/preload').electronAPI
  }
}
