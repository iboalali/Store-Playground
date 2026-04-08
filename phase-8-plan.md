# Phase 8: File Watching, Menu Bar & Polish — Detailed Implementation Plan

## Context

Phases 1–7 are complete. The app has workspace management, app CRUD, store listing editing, screenshot management, a validation engine, and Google Play API integration (publish + import with progress). Phase 8 adds **file watching** for real-time external change detection, a **menu bar** with keyboard shortcuts, and final polish (loading/empty/error states review, build packaging verification).

**Key dependencies already installed:** chokidar v4.0.0, electron-builder v25.0.0. The `electron-builder.yml` already exists with Win/Mac/Linux targets and `asarUnpack` for sharp.

---

## Files to Create (3 new files)

| # | File | Purpose |
|---|------|---------|
| 1 | `src/main/services/watcher.ts` | Chokidar file watcher with 300ms debounce, pause/resume for operation lock |
| 2 | `src/main/ipc/watcher-handlers.ts` | Wire watcher events to renderer via `webContents.send()` |
| 3 | `src/main/menu.ts` | Electron Menu template with File, Edit, View, Actions, Help + accelerators |

## Files to Modify (9 existing files)

| # | File | Changes |
|---|------|---------|
| 4 | `src/shared/types/ipc-channels.ts` | Add `WATCHER_CHANGE` and `MENU_ACTION` channel constants |
| 5 | `src/shared/types/ipc-payloads.ts` | Add `MenuAction` type union |
| 6 | `src/main/index.ts` | Import + init WatcherService, build menu, pass window ref, wire settings change → watcher restart |
| 7 | `src/main/ipc/api-handlers.ts` | Accept WatcherService param, call `pause()`/`resume()` around publish/import |
| 8 | `src/preload/index.ts` | Add `onWatcherChange` and `onMenuAction` event listeners |
| 9 | `src/renderer/src/env.d.ts` | Add `onWatcherChange` and `onMenuAction` to Api interface |
| 10 | `src/renderer/src/lib/ipc.ts` | Add `onWatcherChange` and `onMenuAction` wrappers |
| 11 | `src/renderer/src/App.svelte` | Add `$effect` for watcher subscription (auto-refresh stores) + menu action dispatcher |
| 12 | `src/renderer/src/screens/StoreListingEditor.svelte` | Remove local Ctrl+S keydown handler (now handled by menu accelerator) |

---

## Implementation Steps

### Step 1: IPC Channels & Payload Types

**`src/shared/types/ipc-channels.ts`** — Add:

```typescript
// Watcher channels (Main → Renderer push)
export const WATCHER_CHANGE = 'watcher:change' as const

// Menu channels (Main → Renderer push)
export const MENU_ACTION = 'menu:action' as const
```

Add both to the `IpcChannel` union type.

**`src/shared/types/ipc-payloads.ts`** — Add:

```typescript
// Menu action names dispatched from main menu to renderer
export type MenuAction =
  | 'new-app'
  | 'open-workspace'
  | 'settings'
  | 'save'
  | 'new-listing'
  | 'refresh'
  | 'toggle-archived'
  | 'publish'
  | 'import-live'
  | 'add-localization'
```

---

### Step 2: Watcher Service (`src/main/services/watcher.ts`)

Class-based service wrapping chokidar. Follows the same pattern as `SettingsService`.

```typescript
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
      ignored: [/(^|[\/\\])\../, /node_modules/],
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
```

**Key design decisions:**
- **Single consolidated event:** After debouncing, sends a simple `WATCHER_CHANGE` signal with no payload. The renderer refreshes the active store based on the current route. This is simpler than sending individual file paths since all stores reload entirely from disk anyway.
- **Operation lock:** `pause()` suppresses all events and clears pending debounce. `resume()` triggers a single refresh if any changes occurred while paused.
- **Workspace restart:** Calling `start()` with a new path automatically stops the previous watcher.

---

### Step 3: Watcher IPC Handler (`src/main/ipc/watcher-handlers.ts`)

Thin handler that wires the watcher's window reference. Since watcher events are push-only (Main → Renderer), there are no `ipcMain.handle` calls here — just initialization.

```typescript
import { BrowserWindow } from 'electron'
import { WatcherService } from '../services/watcher'

export function initWatcher(
  watcherService: WatcherService,
  window: BrowserWindow
): void {
  watcherService.setWindow(window)
}
```

---

### Step 4: Menu Bar (`src/main/menu.ts`)

Full Electron `Menu` template following the tech spec. Custom actions send `menu:action` events to the renderer.

```typescript
import { Menu, BrowserWindow } from 'electron'
import { MENU_ACTION } from '$shared/types/ipc-channels'
import type { MenuAction } from '$shared/types/ipc-payloads'

function sendAction(win: BrowserWindow | null, action: MenuAction): void {
  if (win && !win.isDestroyed()) {
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
        { label: 'Settings', accelerator: 'CmdOrCtrl+,', click: () => sendAction(window, 'settings') },
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
        { label: 'Refresh', accelerator: 'F5', click: () => sendAction(window, 'refresh') },
        { label: 'Toggle Archived Versions', click: () => sendAction(window, 'toggle-archived') },
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
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => sendAction(window, 'save') },
        { label: 'New Listing', accelerator: 'CmdOrCtrl+N', click: () => sendAction(window, 'new-listing') },
        { type: 'separator' },
        { label: 'Publish to Google Play', accelerator: 'CmdOrCtrl+Shift+P', click: () => sendAction(window, 'publish') },
        { label: 'Import Live Data', accelerator: 'CmdOrCtrl+Shift+I', click: () => sendAction(window, 'import-live') },
        { type: 'separator' },
        { label: 'Add Localization', accelerator: 'CmdOrCtrl+L', click: () => sendAction(window, 'add-localization') }
      ]
    },
    {
      label: 'Help',
      submenu: [
        { label: 'About Store Playground', role: 'about' }
      ]
    }
  ]

  return Menu.buildFromTemplate(template)
}
```

**Notes:**
- Edit menu uses Electron built-in `role` values — these handle native undo/redo/cut/copy/paste/selectAll for text inputs automatically.
- View zoom uses built-in roles (`zoomIn`, `zoomOut`, `resetZoom`).
- Custom actions (Save, New Listing, Publish, etc.) use `sendAction()` to push events to renderer.
- `CmdOrCtrl` ensures Mac compatibility (Cmd) while using Ctrl on other platforms.
- `toggleDevTools` is included in View for development convenience.

---

### Step 5: Wire Main Process Entry (`src/main/index.ts`)

Changes:
1. Import `WatcherService`, `initWatcher`, `buildMenu`
2. Create `WatcherService` instance
3. After window creation: set up menu, init watcher, start watching if workspace configured
4. Pass `watcherService` to `registerApiHandlers` and `registerSettingsHandlers`

**Important modifications:**
- `createWindow()` must **return** the `BrowserWindow` instance
- Remove `autoHideMenuBar: true` since we now have a proper menu bar

```typescript
import { WatcherService } from './services/watcher'
import { initWatcher } from './ipc/watcher-handlers'
import { buildMenu } from './menu'
import { Menu } from 'electron'

// In app.whenReady():
const watcherService = new WatcherService()

registerSettingsHandlers(settingsService, watcherService)
registerApiHandlers(watcherService)

const mainWindow = createWindow() // Now returns BrowserWindow

const menu = buildMenu(mainWindow)
Menu.setApplicationMenu(menu)

initWatcher(watcherService, mainWindow)

settingsService.get().then((settings) => {
  if (settings.workspacePath) {
    watcherService.start(settings.workspacePath)
  }
})
```

---

### Step 6: Update API Handlers for Operation Lock (`src/main/ipc/api-handlers.ts`)

Add `WatcherService` parameter and wrap publish/import with pause/resume:

```typescript
export function registerApiHandlers(watcherService: WatcherService): void {
  ipcMain.handle(API_PUBLISH, async (event, args) => {
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
  // Same pattern for API_IMPORT_LIVE
}
```

---

### Step 7: Preload Bridge (`src/preload/index.ts`)

Add two new event subscriptions following the existing `onApiProgress` pattern:

```typescript
onWatcherChange: (callback: (...args: unknown[]) => void) => {
  const handler = (): void => callback()
  ipcRenderer.on(WATCHER_CHANGE, handler)
  return (): void => {
    ipcRenderer.removeListener(WATCHER_CHANGE, handler)
  }
},
onMenuAction: (callback: (...args: unknown[]) => void) => {
  const handler = (_ipcEvent: unknown, action: unknown): void => callback(action)
  ipcRenderer.on(MENU_ACTION, handler)
  return (): void => {
    ipcRenderer.removeListener(MENU_ACTION, handler)
  }
}
```

---

### Step 8: Renderer Type Declarations (`src/renderer/src/env.d.ts`)

Add to the `Api` interface:

```typescript
onWatcherChange(callback: () => void): () => void
onMenuAction(callback: (action: string) => void): () => void
```

---

### Step 9: Renderer IPC Wrapper (`src/renderer/src/lib/ipc.ts`)

Add:

```typescript
onWatcherChange(callback: () => void): () => void {
  return window.api.onWatcherChange(callback)
},
onMenuAction(callback: (action: string) => void): () => void {
  return window.api.onMenuAction(callback)
}
```

---

### Step 10: App.svelte — Watcher Subscription + Menu Action Dispatcher

Central integration point. Two new `$effect` blocks:

**Watcher:** Subscribes to change events and refreshes the active store based on current route.

**Menu Actions:** Dispatches actions based on current route. Simple actions (settings, save, toggle-archived, new-listing, refresh) are handled directly. Complex actions with dialog flows (publish, import-live, add-localization, new-app) dispatch custom DOM events that the screen components listen for, keeping screen components as owners of their complex flows.

**Screen-level menu event listeners to add:**
- `AppDashboard.svelte`: Listen for `menu:publish` and `menu:import-live` CustomEvents
- `StoreListingEditor.svelte`: Listen for `menu:add-localization` CustomEvent
- `HomeGrid.svelte`: Listen for `menu:new-app` CustomEvent

---

### Step 11: Add `reload()` Methods to Stores

**`editor.svelte.ts`** — Reload from disk preserving active locale:
```typescript
async reload(): Promise<void> {
  if (!this.appPath || !this.versionDir) return
  try {
    await this.loadLocales()
    if (this.activeLocale && this.locales.includes(this.activeLocale)) {
      await Promise.all([this.loadTexts(), this.loadImages(), this.loadScreenshots()])
    } else if (this.locales.length > 0) {
      await this.loadLocaleData(this.locales[0])
    }
  } catch (err) { this.error = String(err) }
}
```

**`screenshot-manager.svelte.ts`** — Reload config + current version screens:
```typescript
async reload(): Promise<void> {
  if (!this.appPath) return
  try {
    await this.loadConfig()
    if (this.currentVersionName) {
      await this.loadScreens(this.currentVersionName)
    }
  } catch (err) { this.error = String(err) }
}
```

---

### Step 12: Remove Redundant Keydown Handlers

**`StoreListingEditor.svelte`** — Remove the `$effect` block for Ctrl+S keydown (lines 29–40). Now handled by menu accelerator → App.svelte dispatcher.

**`ScreenshotManager.svelte`** — **Keep** the Ctrl+Z handler. The Edit menu's Undo role handles native text undo, while the screenshot undo is a separate app-level operation.

---

### Step 13: Settings Change → Watcher Restart

**`settings-handlers.ts`** — Accept `WatcherService`, restart watcher when workspace path changes:
```typescript
export function registerSettingsHandlers(
  settingsService: SettingsService,
  watcherService: WatcherService
): void {
  // In SETTINGS_SET handler: compare old/new workspacePath,
  // call watcherService.start(newPath) or watcherService.stop()
}
```

---

### Step 14: Build & Package Verification

- `npm run build` — verify electron-vite compiles
- `npx electron-builder --dir` — test packaging
- Existing `electron-builder.yml` already correct (no changes needed)

---

## Reuse Existing Code

| What | Where | How |
|------|-------|-----|
| Push event pattern | `api-handlers.ts`, `preload/index.ts`, `ipc.ts`, `progress.svelte.ts` | Replicate for `WATCHER_CHANGE` and `MENU_ACTION` |
| IPC channel constants | `ipc-channels.ts` | Same `as const` pattern |
| Store class pattern | All stores in `stores/` | Add `reload()` methods |
| `$effect` cleanup pattern | `StoreListingEditor.svelte` L29–40 | Subscribe + return unsubscribe |
| Dependency injection | `index.ts` L42–45 | Pass `WatcherService` to handlers |

---

## Verification

1. **`npm run dev`** — App launches, menu bar visible
2. **File watching:** External edits auto-refresh UI; paused during Publish/Import; single refresh after operation
3. **Menu bar:** All 5 menus render; Edit roles work in text inputs; all keyboard shortcuts functional
4. **Type checking:** `npx svelte-check` + `npx tsc --noEmit -p tsconfig.node.json` — no errors
5. **Build packaging:** `npm run build` + `npx electron-builder --dir` succeed
