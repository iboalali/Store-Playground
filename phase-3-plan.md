# Phase 3: Home Grid Implementation Plan

## Context

Phase 3 adds the Home Grid screen — the first functional screen users see after configuring their workspace. It enables viewing all apps in the workspace as a card grid, creating new apps via a dialog, and navigating to the app dashboard (Phase 4). This requires building a full vertical slice: filesystem service in main process, IPC channels, preload bridge, renderer store, and UI components.

Phases 1 (scaffolding) and 2 (settings + navigation) are complete.

---

## Implementation Steps

### Step 1: Extend Shared Types

**`src/shared/types/models.ts`** — Add `AppEntry` composite type:
```ts
export interface AppEntry {
  appPath: string       // absolute path to app directory
  config: AppConfig     // parsed app_config.json
  hasIcon: boolean      // whether icon.png exists
}
```

**`src/shared/types/ipc-channels.ts`** — Add 7 channel constants + extend union:
- `FS_READ_WORKSPACE = 'fs:read-workspace'`
- `FS_READ_APP_CONFIG = 'fs:read-app-config'`
- `FS_CREATE_DIRECTORY = 'fs:create-directory'`
- `FS_WRITE_JSON_FILE = 'fs:write-json-file'`
- `FS_COPY_IMAGE = 'fs:copy-image'`
- `FS_DELETE_TO_TRASH = 'fs:delete-to-trash'`
- `FS_CREATE_APP = 'fs:create-app'` (high-level atomic operation)

**`src/shared/types/ipc-payloads.ts`** — Add request/response types for each channel, following existing `IpcResult<T>` pattern. Key payloads:
- `FsReadWorkspaceRequest { workspacePath }` -> `IpcResult<AppEntry[]>`
- `FsCreateAppRequest { workspacePath, appName, packageName }` -> `IpcResult<AppEntry>`
- Standard CRUD payloads for create-directory, write-json-file, copy-image, delete-to-trash

### Step 2: Create Filesystem Service

**`src/main/services/filesystem.ts`** — NEW file, pure Node.js (no Electron imports):
- `readWorkspace(workspacePath)` — `readdir` with `withFileTypes`, filter dirs, read each `app_config.json`, check `icon.png` existence, return `AppEntry[]` sorted by name. Skip dirs without valid `app_config.json`.
- `readAppConfig(appPath)` — read + parse `app_config.json`
- `createDirectory(dirPath)` — `mkdir({ recursive: true })`
- `writeJsonFile(filePath, data)` — `JSON.stringify(data, null, 2)` + `writeFile`
- `copyImage(src, dest)` — `copyFile` from `node:fs/promises`

Note: `trashItem` excluded from service (Electron-specific); handler calls `shell.trashItem` directly.

### Step 3: Create FS IPC Handlers

**`src/main/ipc/fs-handlers.ts`** — NEW file:
- `registerFsHandlers()` — registers all 7 `ipcMain.handle` calls
- Each wraps service call in try/catch returning `IpcResult<T>`
- `fs:delete-to-trash` calls `shell.trashItem()` directly (Electron API)
- `fs:create-app` is a high-level handler that atomically:
  1. Checks dir doesn't already exist
  2. Creates `{workspace}/{appName}/` directory
  3. Writes `app_config.json` with `{ appName, packageName, liveVersionDir: null }`
  4. Writes `app_details.json` with defaults: `{ defaultLanguage: 'en-US', contactEmail: '', contactWebsite: '', contactPhone: '', privacyPolicyUrl: '' }`
  5. Copies `resources/default-app-icon.png` to `{appPath}/icon.png`
  6. Returns the new `AppEntry`
- Default icon path resolution: `is.dev ? join(process.cwd(), 'resources', 'default-app-icon.png') : join(process.resourcesPath, 'default-app-icon.png')`

**`src/main/index.ts`** — MODIFY: import and call `registerFsHandlers()` alongside existing handler registrations.

### Step 4: Extend Preload Bridge

**`src/preload/index.ts`** — MODIFY: add 7 new methods to the `api` object:
- `readWorkspace`, `readAppConfig`, `createDirectory`, `writeJsonFile`, `copyImage`, `deleteToTrash`, `createApp`
- Each calls `ipcRenderer.invoke(CHANNEL_CONST, args)`

**`src/renderer/src/env.d.ts`** — MODIFY: extend `Api` interface with matching method signatures.

### Step 5: Extend Renderer IPC Wrapper

**`src/renderer/src/lib/ipc.ts`** — MODIFY: add 7 methods to `ipc` object:
- Each calls `unwrap(await window.api.methodName(args))`
- Provides clean typed API: `ipc.readWorkspace(path)`, `ipc.createApp({...})`, etc.

### Step 6: Create App State Store

**`src/renderer/src/stores/app-state.svelte.ts`** — NEW file:
- Class `AppStateStore` with Svelte 5 runes pattern (matching `SettingsStore`)
- State: `apps: AppEntry[]`, `loading: boolean`, `error: string | null`
- Derived: `sortedApps` (alphabetical by appName), `appCount`
- Methods: `loadWorkspace(workspacePath)`, `refresh(workspacePath)`
- Export singleton: `appStateStore`

### Step 7: Create Default App Icon

**`resources/default-app-icon.png`** — NEW: 512x512 PNG placeholder (used by main process to copy into new app dirs). Generate a simple gray placeholder programmatically.

**`src/renderer/src/assets/default-app-icon.png`** — NEW: same image for renderer display in AppCard when no icon exists. Imported as Vite asset.

### Step 8: Update CSP for Local Image Loading

**`src/renderer/index.html`** — MODIFY: update CSP to allow local-file://, file://, and data: images:
```
img-src 'self' file: data: local-file:
```
Required for displaying app icons from the workspace filesystem. A custom `local-file://` protocol is registered in the main process to serve workspace files, since `file://` URLs are blocked when the renderer loads from `http://localhost` in dev mode.

### Step 9: Build UI Components

**`src/renderer/src/components/home/AppCard.svelte`** — NEW:
- Props: `appEntry: AppEntry`
- Clickable card calling `goToDashboard(appEntry.appPath)`
- Shows icon (local-file:// URL if hasIcon, else default-app-icon import), app name, package name
- `onerror` handler on `<img>` falls back to default icon
- Styled as card: white bg, border, rounded corners, hover state, ~64x64 icon

**`src/renderer/src/components/home/AddAppDialog.svelte`** — NEW:
- Props: `open: boolean`, `onclose`, `oncreate: (appName, packageName) => void`
- Uses HTML `<dialog>` element for native modal
- Form fields: App Name (text), Package Name (text)
- Validation: appName required + filesystem-safe chars; packageName matches Android format `^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$`
- Cancel/Create buttons

**`src/renderer/src/screens/HomeGrid.svelte`** — NEW:
- Loads workspace via `$effect` when workspacePath exists
- Renders grid of `AppCard` components from `appStateStore.sortedApps`
- Last grid item is a dashed "+" card opening the AddAppDialog
- `handleCreate` calls `ipc.createApp(...)`, closes dialog, refreshes store
- Shows loading/error/empty states

### Step 10: Wire into App.svelte

**`src/renderer/src/App.svelte`** — MODIFY:
- Import `HomeGrid` component
- Replace `{:else if route.screen === 'home'}` placeholder with `<HomeGrid />`

---

## Files Summary

**Create (8):**
1. `src/main/services/filesystem.ts`
2. `src/main/ipc/fs-handlers.ts`
3. `src/renderer/src/stores/app-state.svelte.ts`
4. `src/renderer/src/screens/HomeGrid.svelte`
5. `src/renderer/src/components/home/AppCard.svelte`
6. `src/renderer/src/components/home/AddAppDialog.svelte`
7. `resources/default-app-icon.png`
8. `src/renderer/src/assets/default-app-icon.png`

**Modify (7):**
1. `src/shared/types/models.ts` — add AppEntry
2. `src/shared/types/ipc-channels.ts` — add 7 channel constants
3. `src/shared/types/ipc-payloads.ts` — add request/response types
4. `src/preload/index.ts` — add 7 api methods
5. `src/renderer/src/env.d.ts` — extend Api interface
6. `src/renderer/src/lib/ipc.ts` — add 7 ipc methods
7. `src/renderer/src/App.svelte` — swap placeholder for HomeGrid
8. `src/renderer/index.html` — update CSP for img-src
9. `src/main/index.ts` — register fs handlers

---

## Key Design Decisions

1. **`fs:create-app` as atomic IPC** — Instead of having the renderer orchestrate multiple fs calls, a single high-level channel handles the entire create-app flow. The main process knows where the default icon lives, so the renderer never needs to resolve resource paths.

2. **Icon loading via local-file:// custom protocol** — A custom `local-file://` protocol is registered in the main process via `protocol.handle()` to serve workspace files. This is required because in dev mode the renderer loads from `http://localhost`, which blocks cross-origin `file://` URLs. CSP updated to allow `img-src file: data: local-file:`.

3. **Stateless filesystem service** — Unlike SettingsService (class with cache), the filesystem module exports plain functions since there's no persistent state to manage.

4. **Store takes workspacePath as parameter** — Avoids coupling app-state store to settings store. The calling component passes it in.

---

## Verification

1. `npm run dev` — app launches, home grid shows
2. Empty workspace: shows empty grid with just the "+" card
3. Click "+" -> AddAppDialog opens -> enter valid name/package -> creates app folder with correct files
4. New app card appears in grid after creation
5. Click app card -> navigates to dashboard (placeholder is fine, Phase 4)
6. Invalid inputs (empty name, bad package format, duplicate app name) show validation errors
7. App icons display correctly from workspace
8. `npx svelte-check` — no type errors
9. `npx tsc --noEmit -p tsconfig.node.json` — no type errors
