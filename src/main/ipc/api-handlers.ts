import { ipcMain } from 'electron'
import { API_PUBLISH, API_IMPORT_LIVE, API_PROGRESS } from '$shared/types/ipc-channels'
import type { ApiPublishRequest, ApiImportLiveRequest } from '$shared/types/ipc-payloads'
import { publishToGooglePlay } from '../services/google-play/publish'
import { importFromGooglePlay } from '../services/google-play/import'

export function registerApiHandlers(): void {
  ipcMain.handle(API_PUBLISH, async (event, args: ApiPublishRequest) => {
    try {
      await publishToGooglePlay(args, (progress) => {
        event.sender.send(API_PROGRESS, progress)
      })
      return { success: true, data: undefined }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle(API_IMPORT_LIVE, async (event, args: ApiImportLiveRequest) => {
    try {
      await importFromGooglePlay(args, (progress) => {
        event.sender.send(API_PROGRESS, progress)
      })
      return { success: true, data: undefined }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
}
