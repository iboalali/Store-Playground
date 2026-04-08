import { Menu, BrowserWindow } from 'electron'
import { MENU_ACTION } from '$shared/types/ipc-channels'
import type { MenuAction } from '$shared/types/ipc-payloads'

function sendAction(win: BrowserWindow, action: MenuAction): void {
  if (!win.isDestroyed()) {
    win.webContents.send(MENU_ACTION, action)
  }
}

export function buildMenu(window: BrowserWindow): Menu {
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'New App', click: () => sendAction(window, 'new-app') },
        { label: 'Open Workspace', click: () => sendAction(window, 'open-workspace') },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => sendAction(window, 'settings')
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Refresh',
          accelerator: 'F5',
          click: () => sendAction(window, 'refresh')
        },
        {
          label: 'Toggle Archived Versions',
          click: () => sendAction(window, 'toggle-archived')
        },
        { type: 'separator' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
        { type: 'separator' },
        { role: 'toggleDevTools' }
      ]
    },
    {
      label: 'Actions',
      submenu: [
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendAction(window, 'save')
        },
        {
          label: 'New Listing',
          accelerator: 'CmdOrCtrl+N',
          click: () => sendAction(window, 'new-listing')
        },
        { type: 'separator' },
        {
          label: 'Publish to Google Play',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => sendAction(window, 'publish')
        },
        {
          label: 'Import Live Data',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => sendAction(window, 'import-live')
        },
        { type: 'separator' },
        {
          label: 'Add Localization',
          accelerator: 'CmdOrCtrl+L',
          click: () => sendAction(window, 'add-localization')
        }
      ]
    },
    {
      label: 'Help',
      submenu: [{ label: 'About Store Playground', role: 'about' }]
    }
  ]

  return Menu.buildFromTemplate(template)
}
