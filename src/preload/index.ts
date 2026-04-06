import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import {
  SETTINGS_GET,
  SETTINGS_SET,
  DIALOG_OPEN_DIRECTORY,
  DIALOG_OPEN_FILE
} from '$shared/types/ipc-channels'

contextBridge.exposeInMainWorld('electron', electronAPI)

contextBridge.exposeInMainWorld('api', {
  // Settings
  getSettings: () => ipcRenderer.invoke(SETTINGS_GET),
  setSettings: (partial: Record<string, unknown>) => ipcRenderer.invoke(SETTINGS_SET, partial),

  // Native dialogs
  openDirectoryDialog: (args?: { title?: string; defaultPath?: string }) =>
    ipcRenderer.invoke(DIALOG_OPEN_DIRECTORY, args),
  openFileDialog: (
    args?: {
      title?: string
      defaultPath?: string
      filters?: Array<{ name: string; extensions: string[] }>
    }
  ) => ipcRenderer.invoke(DIALOG_OPEN_FILE, args)
})
