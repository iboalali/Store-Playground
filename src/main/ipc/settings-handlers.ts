import { ipcMain, dialog, BrowserWindow } from 'electron'
import {
  SETTINGS_GET,
  SETTINGS_SET,
  DIALOG_OPEN_DIRECTORY,
  DIALOG_OPEN_FILE
} from '$shared/types/ipc-channels'
import type { SettingsSetRequest, IpcResult } from '$shared/types/ipc-payloads'
import type { Settings } from '$shared/types/models'
import type { SettingsService } from '../services/settings'

export function registerSettingsHandlers(settingsService: SettingsService): void {
  ipcMain.handle(SETTINGS_GET, async (): Promise<IpcResult<Settings>> => {
    try {
      const settings = await settingsService.get()
      return { success: true, data: settings }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle(
    SETTINGS_SET,
    async (_event, partial: SettingsSetRequest): Promise<IpcResult<Settings>> => {
      try {
        const updated = await settingsService.set(partial)
        return { success: true, data: updated }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )
}

export function registerDialogHandlers(): void {
  ipcMain.handle(
    DIALOG_OPEN_DIRECTORY,
    async (
      _event,
      args?: { title?: string; defaultPath?: string }
    ): Promise<IpcResult<string | null>> => {
      try {
        const win = BrowserWindow.getFocusedWindow()
        const result = await dialog.showOpenDialog(win!, {
          title: args?.title ?? 'Select Directory',
          defaultPath: args?.defaultPath,
          properties: ['openDirectory', 'createDirectory']
        })
        return { success: true, data: result.canceled ? null : result.filePaths[0] }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

  ipcMain.handle(
    DIALOG_OPEN_FILE,
    async (
      _event,
      args?: {
        title?: string
        defaultPath?: string
        filters?: Array<{ name: string; extensions: string[] }>
      }
    ): Promise<IpcResult<string | null>> => {
      try {
        const win = BrowserWindow.getFocusedWindow()
        const result = await dialog.showOpenDialog(win!, {
          title: args?.title ?? 'Select File',
          defaultPath: args?.defaultPath,
          filters: args?.filters,
          properties: ['openFile']
        })
        return { success: true, data: result.canceled ? null : result.filePaths[0] }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )
}
