import { watch, type FSWatcher } from 'chokidar'
import { BrowserWindow } from 'electron'
import { WATCHER_CHANGE } from '$shared/types/ipc-channels'

export class WatcherService {
  private watcher: FSWatcher | null = null
  private paused = false
  private pendingRefresh = false
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private window: BrowserWindow | null = null
  private currentPath: string | null = null

  setWindow(win: BrowserWindow): void {
    this.window = win
  }

  async start(workspacePath: string): Promise<void> {
    // Stop existing watcher if watching a different path
    if (this.currentPath !== workspacePath) {
      await this.stop()
    }
    if (this.watcher) return // Already watching this path

    this.currentPath = workspacePath
    this.paused = false
    this.pendingRefresh = false

    this.watcher = watch(workspacePath, {
      persistent: true,
      ignoreInitial: true,
      ignored: [/(^|[/\\])\../, /node_modules/],
      depth: 10
    })

    const handleEvent = (): void => {
      if (this.paused) {
        this.pendingRefresh = true
        return
      }
      this.debouncedEmit()
    }

    this.watcher.on('add', handleEvent)
    this.watcher.on('change', handleEvent)
    this.watcher.on('unlink', handleEvent)
  }

  async stop(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
    }
    this.currentPath = null
    this.pendingRefresh = false
  }

  pause(): void {
    this.paused = true
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
  }

  resume(): void {
    this.paused = false
    if (this.pendingRefresh) {
      this.pendingRefresh = false
      this.emit()
    }
  }

  private debouncedEmit(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      this.emit()
    }, 300)
  }

  private emit(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send(WATCHER_CHANGE)
    }
  }
}
