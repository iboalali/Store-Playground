import { app, BrowserWindow, Menu, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { SettingsService } from './services/settings'
import { WatcherService } from './services/watcher'
import { registerSettingsHandlers, registerDialogHandlers } from './ipc/settings-handlers'
import { registerFsHandlers } from './ipc/fs-handlers'
import { registerValidationHandlers } from './ipc/validation-handlers'
import { registerApiHandlers } from './ipc/api-handlers'
import { registerReportsHandlers } from './ipc/reports-handlers'
import { initWatcher } from './ipc/watcher-handlers'
import { buildMenu } from './menu'

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.whenReady().then(() => {
  // Initialize services
  const settingsService = new SettingsService(app.getPath('userData'))
  const watcherService = new WatcherService()

  // Register IPC handlers before window creation
  registerSettingsHandlers(settingsService, watcherService)
  registerDialogHandlers()
  registerFsHandlers()
  registerValidationHandlers()
  registerApiHandlers(watcherService)
  registerReportsHandlers()

  const mainWindow = createWindow()

  // Set up menu bar
  const menu = buildMenu(mainWindow)
  Menu.setApplicationMenu(menu)

  // Init watcher with window reference and start if workspace configured
  initWatcher(watcherService, mainWindow)
  settingsService.get().then((settings) => {
    if (settings.workspacePath) {
      watcherService.start(settings.workspacePath)
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
