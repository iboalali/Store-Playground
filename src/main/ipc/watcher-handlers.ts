import { BrowserWindow } from 'electron'
import { WatcherService } from '../services/watcher'

export function initWatcher(
  watcherService: WatcherService,
  window: BrowserWindow
): void {
  watcherService.setWindow(window)
}
