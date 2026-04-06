# Phase 2: Settings + Navigation Infrastructure

## Context

Store Playground is an Electron + Svelte 5 desktop app for managing Google Play Store listing assets. Phase 1 (scaffolding) is complete: we have a running Electron window with Svelte rendering a placeholder. Phase 2 adds the foundational infrastructure — shared types, IPC plumbing, a state-based router, a settings page, and a header with breadcrumb navigation. After Phase 2, the app will redirect to Settings on first launch, allow configuring workspace/service-account paths, and navigate between screens.

---

## Files to Create/Modify

### New Files (10)
1. `src/shared/types/models.ts`
2. `src/shared/types/ipc-channels.ts`
3. `src/shared/types/ipc-payloads.ts`
4. `src/main/services/settings.ts`
5. `src/main/ipc/settings-handlers.ts`
6. `src/renderer/src/lib/ipc.ts`
7. `src/renderer/src/router.svelte.ts`
8. `src/renderer/src/stores/settings.svelte.ts`
9. `src/renderer/src/screens/Settings.svelte`
10. `src/renderer/src/components/layout/Header.svelte`

### Modified Files (4)
1. `src/shared/types/index.ts` — re-export from new type files
2. `src/preload/index.ts` — add typed IPC methods
3. `src/renderer/src/App.svelte` — router switch + settings redirect
4. `src/main/index.ts` — initialize services + register IPC handlers
5. `electron.vite.config.ts` — add `$shared` alias to main/preload builds

---

## Implementation Steps

### Step 1: Shared Types — `src/shared/types/models.ts`

Define data model interfaces. Phase 2 uses `Settings` at runtime; others are forward declarations.

```typescript
export interface Settings {
  workspacePath: string | null
  serviceAccountKeyPath: string | null
}

export interface AppConfig {
  appName: string
  packageName: string
  liveVersionDir: string | null
}

export interface AppDetails {
  defaultLanguage: string
  contactEmail: string
  contactWebsite: string
  contactPhone: string
  privacyPolicyUrl: string
}

export type VersionStatus = 'draft' | 'published' | 'archived'

export interface VersionMetadata {
  createdAt: string
  status: VersionStatus
  customNotes: string
}
```

### Step 2: Shared Types — `src/shared/types/ipc-channels.ts`

Channel name constants with `as const` for literal types. Phase 2 needs settings + dialog channels.

```typescript
export const SETTINGS_GET = 'settings:get' as const
export const SETTINGS_SET = 'settings:set' as const
export const DIALOG_OPEN_DIRECTORY = 'dialog:open-directory' as const
export const DIALOG_OPEN_FILE = 'dialog:open-file' as const

export type IpcChannel =
  | typeof SETTINGS_GET
  | typeof SETTINGS_SET
  | typeof DIALOG_OPEN_DIRECTORY
  | typeof DIALOG_OPEN_FILE
```

Dialog channels are needed for native folder/file pickers on the Settings page.

### Step 3: Shared Types — `src/shared/types/ipc-payloads.ts`

Generic `IpcResult<T>` wrapper + per-channel request/response types.

```typescript
export type IpcResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }
```

- `settings:get` — no args, returns `IpcResult<Settings>`
- `settings:set` — takes `Partial<Settings>`, returns `IpcResult<Settings>`
- `dialog:open-directory` — optional `{title, defaultPath}`, returns `IpcResult<string | null>` (null = cancelled)
- `dialog:open-file` — optional `{title, defaultPath, filters}`, returns `IpcResult<string | null>`

### Step 4: Update `src/shared/types/index.ts`

Replace placeholder with re-exports:
```typescript
export * from './models'
export * from './ipc-channels'
export * from './ipc-payloads'
```

### Step 5: Update `electron.vite.config.ts`

Add `$shared` resolve alias to `main` and `preload` sections so IPC handlers and preload can import from `$shared/types/*`:

```typescript
main: {
  resolve: { alias: { $shared: resolve('src/shared') } },
  build: { rollupOptions: { external: ['sharp'] } }
},
preload: {
  resolve: { alias: { $shared: resolve('src/shared') } },
  build: { rollupOptions: { external: ['sharp'] } }
},
```

### Step 6: Settings Service — `src/main/services/settings.ts`

Pure Node.js (no Electron imports). Class-based with constructor injection of `userDataPath`.

- **Constructor**: takes `userDataPath`, computes `filePath = join(userDataPath, 'settings.json')`
- **`get()`**: reads file, parses JSON, merges with defaults. Returns defaults on first launch (file missing). Caches in memory.
- **`set(partial)`**: merges partial into current, writes to disk, updates cache.
- **Defaults**: `{ workspacePath: null, serviceAccountKeyPath: null }`

### Step 7: IPC Handlers — `src/main/ipc/settings-handlers.ts`

Two exported functions:
- **`registerSettingsHandlers(settingsService)`** — registers `settings:get` and `settings:set` via `ipcMain.handle`. Thin dispatchers that call service methods and wrap in `IpcResult`.
- **`registerDialogHandlers()`** — registers `dialog:open-directory` and `dialog:open-file`. Uses `dialog.showOpenDialog` with `BrowserWindow.getFocusedWindow()` for modal parenting. Directory picker includes `'createDirectory'` property.

### Step 8: Preload Bridge — `src/preload/index.ts`

Update to expose typed IPC methods:

```typescript
contextBridge.exposeInMainWorld('api', {
  getSettings: () => ipcRenderer.invoke(SETTINGS_GET),
  setSettings: (partial) => ipcRenderer.invoke(SETTINGS_SET, partial),
  openDirectoryDialog: (args?) => ipcRenderer.invoke(DIALOG_OPEN_DIRECTORY, args),
  openFileDialog: (args?) => ipcRenderer.invoke(DIALOG_OPEN_FILE, args),
})
```

Also need a type declaration (either inline `env.d.ts` in renderer or a `src/preload/index.d.ts` referenced by tsconfig.web.json) declaring the `Window.api` interface so the renderer has type-safe access.

### Step 9: IPC Wrapper — `src/renderer/src/lib/ipc.ts`

Typed wrapper around `window.api`. Has a private `unwrap<T>(result: IpcResult<T>): T` helper that throws on error. Exports an `ipc` object with async methods that call `window.api.*` and unwrap:

- `ipc.getSettings()` → `Promise<Settings>`
- `ipc.setSettings(partial)` → `Promise<Settings>`
- `ipc.openDirectoryDialog(args?)` → `Promise<string | null>`
- `ipc.openFileDialog(args?)` → `Promise<string | null>`

Single mock point for future testing.

### Step 10: Router — `src/renderer/src/router.svelte.ts`

Module-level `$state<Route>` with discriminated union. All 6 screens defined for forward compatibility:

```typescript
export type Route =
  | { screen: 'home' }
  | { screen: 'settings' }
  | { screen: 'dashboard'; appPath: string }
  | { screen: 'editor'; appPath: string; versionDir: string }
  | { screen: 'screenshots'; appPath: string }
  | { screen: 'reports'; appPath: string }
```

Exports: `getRoute()`, `navigate(to)`, plus convenience functions `goHome()`, `goSettings()`, `goToDashboard(appPath)`, `goToEditor(appPath, versionDir)`, `goToScreenshots(appPath)`, `goToReports(appPath)`.

### Step 11: Settings Store — `src/renderer/src/stores/settings.svelte.ts`

Class-based singleton using Svelte 5 runes:

- **State fields**: `workspacePath`, `serviceAccountKeyPath` (both `$state<string | null>`), `loaded` (`$state(false)`), `error` (`$state<string | null>`)
- **Derived**: `isConfigured = $derived(this.workspacePath !== null)`
- **Methods**: `load()`, `setWorkspacePath(path)`, `setServiceAccountKeyPath(path)`, `pickWorkspaceDirectory()`, `pickServiceAccountKey()`
- The `pick*` methods combine dialog + save in one call
- Exported as `export const settingsStore = new SettingsStore()`

### Step 12: Header — `src/renderer/src/components/layout/Header.svelte`

Fixed header bar (~48px) with:
- **Left**: Breadcrumb nav derived from `getRoute()`. Clickable crumbs for parent screens, bold active crumb.
- **Right**: Gear icon button → `goSettings()`
- **Styling**: `-webkit-app-region: drag` on header for window dragging; `-webkit-app-region: no-drag` on interactive elements. White background, bottom border, flex space-between.
- **Props**: `appName?: string` passed from parent for dashboard/editor/screenshots breadcrumbs.
- Gear icon: inline SVG (no icon library).

### Step 13: Settings Screen — `src/renderer/src/screens/Settings.svelte`

Settings page with:
- **Workspace Directory**: label, description text, path display (monospace, truncated), "Browse..." button calling `settingsStore.pickWorkspaceDirectory()`
- **Service Account Key**: same pattern, "Browse..." button with JSON filter, calling `settingsStore.pickServiceAccountKey()`
- **Error banner**: shown if `settingsStore.error` is set
- **"Back to Home" button**: only visible when `settingsStore.isConfigured` is true
- **Styling**: centered content, max-width ~600px, card-like setting groups with subtle borders

### Step 14: App.svelte Rewrite — `src/renderer/src/App.svelte`

Root layout shell + router switch:

```svelte
<script lang="ts">
  import { getRoute, goSettings } from './router.svelte'
  import { settingsStore } from './stores/settings.svelte'
  import Header from './components/layout/Header.svelte'
  import Settings from './screens/Settings.svelte'

  // Load settings on mount, redirect if unconfigured
  $effect(() => {
    settingsStore.load().then(() => {
      if (!settingsStore.isConfigured) goSettings()
    })
  })

  const route = $derived(getRoute())
</script>

{#if !settingsStore.loaded}
  <!-- Loading state while settings load -->
  <div class="loading">Loading...</div>
{:else}
  <Header />
  {#if route.screen === 'settings'}
    <Settings />
  {:else if route.screen === 'home'}
    <main class="placeholder"><p>Home Grid (Phase 3)</p></main>
  {:else if route.screen === 'dashboard'}
    <main class="placeholder"><p>App Dashboard (Phase 4)</p></main>
  {:else if route.screen === 'editor'}
    <main class="placeholder"><p>Store Listing Editor (Phase 5)</p></main>
  {:else if route.screen === 'screenshots'}
    <main class="placeholder"><p>Screenshot Manager (Phase 5.5)</p></main>
  {:else if route.screen === 'reports'}
    <main class="placeholder"><p>Financial Reports (Phase 9)</p></main>
  {/if}
{/if}
```

- Shows loading state until settings are fetched
- Redirects to Settings if no workspace configured
- Future screens get placeholder `<main>` blocks until implemented

### Step 15: Main Process Updates — `src/main/index.ts`

Update to initialize services and register IPC handlers:

```typescript
import { app, BrowserWindow, shell } from 'electron'
import { SettingsService } from './services/settings'
import { registerSettingsHandlers, registerDialogHandlers } from './ipc/settings-handlers'

app.whenReady().then(() => {
  // Initialize services
  const settingsService = new SettingsService(app.getPath('userData'))

  // Register IPC handlers
  registerSettingsHandlers(settingsService)
  registerDialogHandlers()

  // Create window
  createWindow()
  // ... rest unchanged
})
```

IPC handlers are registered before window creation so they're ready when the renderer loads.

---

## Verification

1. `npm run dev` — app launches without errors
2. First launch: app redirects to Settings page (no workspace configured)
3. Click "Browse..." for workspace → native directory picker opens → selected path displays
4. Click "Browse..." for service account key → native file picker (JSON filter) opens → selected path displays
5. Settings persist across app restart (check `userData/settings.json` created)
6. After workspace set: "Back to Home" button appears → clicking navigates to Home placeholder
7. Header breadcrumbs show correct path for each route
8. Gear icon navigates to Settings from any screen
9. `npx svelte-check` — no type errors in renderer
10. `npx tsc --noEmit -p tsconfig.node.json` — no type errors in main/preload
