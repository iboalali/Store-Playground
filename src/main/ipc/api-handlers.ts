import { ipcMain } from 'electron'
import { API_PUBLISH, API_IMPORT_LIVE, API_PROGRESS } from '$shared/types/ipc-channels'
import type { ApiPublishRequest, ApiImportLiveRequest } from '$shared/types/ipc-payloads'
import { publishToGooglePlay } from '../services/google-play/publish'
import { importFromGooglePlay } from '../services/google-play/import'
import { WatcherService } from '../services/watcher'

export function registerApiHandlers(watcherService: WatcherService): void {
  ipcMain.handle(API_PUBLISH, async (event, args: ApiPublishRequest) => {
    try {
      watcherService.pause()
      await publishToGooglePlay(args, (progress) => {
        event.sender.send(API_PROGRESS, progress)
      })
      return { success: true, data: undefined }
    } catch (err) {
      return { success: false, error: String(err) }
    } finally {
      watcherService.resume()
    }
  })

  ipcMain.handle(API_IMPORT_LIVE, async (event, args: ApiImportLiveRequest) => {
    try {
      watcherService.pause()
      await importFromGooglePlay(args, (progress) => {
        event.sender.send(API_PROGRESS, progress)
      })
      return { success: true, data: undefined }
    } catch (err) {
      return { success: false, error: String(err) }
    } finally {
      watcherService.resume()
    }
  })
}
