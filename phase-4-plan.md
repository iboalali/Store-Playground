# Phase 4: App Dashboard (Screen 2) — Implementation Plan

## Context

Phase 4 builds the App Dashboard screen — the second main screen after the Home Grid. When a user clicks an app card on the Home Grid, they navigate to this dashboard. It displays the app's global details (contact info, default language, privacy policy), lists all store listing versions, and provides full CRUD actions: create new listing, duplicate, rename, archive, delete listing, and delete app. Phases 1-3 are complete: scaffolding, settings, navigation infrastructure, and the Home Grid.

---

## Files to Modify (existing)

| File | Changes |
|------|---------|
| `src/shared/types/models.ts` | Add `VersionEntry` interface |
| `src/shared/types/ipc-channels.ts` | Add 4 new channel constants + union members |
| `src/shared/types/ipc-payloads.ts` | Add 4 new request/response type pairs |
| `src/main/services/filesystem.ts` | Add 5 new functions: `readAppDetails`, `listVersions`, `copyDirectory`, `renameItem`, `writeTextFile` |
| `src/main/ipc/fs-handlers.ts` | Register 4 new IPC handlers |
| `src/preload/index.ts` | Add 4 new methods to `window.api` |
| `src/renderer/src/lib/ipc.ts` | Add 4 new wrapper methods |
| `src/renderer/src/App.svelte` | Replace dashboard placeholder with `<AppDashboard />` |

## Files to Create (new)

| File | Purpose |
|------|---------|
| `src/renderer/src/stores/current-app.svelte.ts` | Dashboard state: config, details, versions, derived helpers |
| `src/renderer/src/screens/AppDashboard.svelte` | Dashboard screen layout |
| `src/renderer/src/components/dashboard/AppDetailsForm.svelte` | Editable app_details.json form |
| `src/renderer/src/components/dashboard/VersionCard.svelte` | Single version display card |
| `src/renderer/src/components/dashboard/VersionActions.svelte` | Action buttons for a version |
| `src/renderer/src/components/shared/ConfirmDialog.svelte` | Reusable confirmation modal |

---

## Step 1: Add New Types

### `src/shared/types/models.ts` — add `VersionEntry`:
```typescript
export interface VersionEntry {
  dirName: string       // directory name, e.g. "v1_initial"
  dirPath: string       // full absolute path
  metadata: VersionMetadata
  isLive: boolean       // true if dirName === appConfig.liveVersionDir
}
```

### `src/shared/types/ipc-channels.ts` — add 4 channels:
```typescript
export const FS_READ_APP_DETAILS = 'fs:read-app-details' as const
export const FS_LIST_VERSIONS = 'fs:list-versions' as const
export const FS_COPY_DIRECTORY = 'fs:copy-directory' as const
export const FS_RENAME_ITEM = 'fs:rename-item' as const
```
Add all 4 to the `IpcChannel` union.

### `src/shared/types/ipc-payloads.ts` — add request/response pairs:
```typescript
// fs:read-app-details
export interface FsReadAppDetailsRequest { appPath: string }
export type FsReadAppDetailsResponse = IpcResult<AppDetails>

// fs:list-versions — scans app dir for subdirs containing version_metadata.json
export interface FsListVersionsRequest { appPath: string }
export type FsListVersionsResponse = IpcResult<VersionEntry[]>

// fs:copy-directory — recursive copy
export interface FsCopyDirectoryRequest { src: string; dest: string }
export type FsCopyDirectoryResponse = IpcResult<void>

// fs:rename-item — rename file or directory (same parent)
export interface FsRenameItemRequest { oldPath: string; newPath: string }
export type FsRenameItemResponse = IpcResult<void>
```

---

## Step 2: Add Filesystem Service Functions

In `src/main/services/filesystem.ts`, add:

```typescript
import { readdir, readFile, mkdir, writeFile, copyFile, access, rename, cp } from 'node:fs/promises'
```

### `readAppDetails(appPath: string): Promise<AppDetails>`
Read and parse `{appPath}/app_details.json`.

### `listVersions(appPath: string): Promise<{ dirName: string; dirPath: string; metadata: VersionMetadata }[]>`
Scan `appPath` for subdirectories containing `version_metadata.json`. For each, read the metadata. Return sorted by `createdAt` descending (newest first). Skip dirs without version_metadata.json. Note: `isLive` is NOT determined here — that's the caller's job (IPC handler or renderer) since it requires `appConfig.liveVersionDir`.

### `copyDirectory(src: string, dest: string): Promise<void>`
Use `cp(src, dest, { recursive: true })` (Node 16.7+ / Electron's Node).

### `renameItem(oldPath: string, newPath: string): Promise<void>`
Use `rename(oldPath, newPath)`.

### `writeTextFile(filePath: string, content: string): Promise<void>`
Use `writeFile(filePath, content, 'utf-8')`. (Needed by future phases but useful to add now.)

---

## Step 3: Register IPC Handlers

In `src/main/ipc/fs-handlers.ts`, add handlers inside `registerFsHandlers()`:

1. **FS_READ_APP_DETAILS** — calls `filesystem.readAppDetails(args.appPath)`, wraps in IpcResult
2. **FS_LIST_VERSIONS** — calls `filesystem.listVersions(args.appPath)`, then reads appConfig to set `isLive` on each entry, wraps in IpcResult
3. **FS_COPY_DIRECTORY** — calls `filesystem.copyDirectory(args.src, args.dest)`, wraps in IpcResult
4. **FS_RENAME_ITEM** — calls `filesystem.renameItem(args.oldPath, args.newPath)`, wraps in IpcResult

For `FS_LIST_VERSIONS`: read `app_config.json` to get `liveVersionDir`, then map each version entry to set `isLive: v.dirName === config.liveVersionDir`.

---

## Step 4: Wire Preload + IPC Wrapper

### `src/preload/index.ts` — add to `window.api`:
```typescript
readAppDetails: (args: { appPath: string }) => ipcRenderer.invoke(FS_READ_APP_DETAILS, args),
listVersions: (args: { appPath: string }) => ipcRenderer.invoke(FS_LIST_VERSIONS, args),
copyDirectory: (args: { src: string; dest: string }) => ipcRenderer.invoke(FS_COPY_DIRECTORY, args),
renameItem: (args: { oldPath: string; newPath: string }) => ipcRenderer.invoke(FS_RENAME_ITEM, args),
```

### `src/renderer/src/lib/ipc.ts` — add methods:
```typescript
async readAppDetails(appPath: string): Promise<AppDetails> {
  return unwrap(await window.api.readAppDetails({ appPath }))
},
async listVersions(appPath: string): Promise<VersionEntry[]> {
  return unwrap(await window.api.listVersions({ appPath }))
},
async copyDirectory(src: string, dest: string): Promise<void> {
  return unwrap(await window.api.copyDirectory({ src, dest }))
},
async renameItem(oldPath: string, newPath: string): Promise<void> {
  return unwrap(await window.api.renameItem({ oldPath, newPath }))
},
```

### `src/renderer/src/env.d.ts` — add the 4 new methods to the `Window['api']` interface.

---

## Step 5: Build `current-app` Store

**File:** `src/renderer/src/stores/current-app.svelte.ts`

Follow the existing store pattern (class-based singleton with `$state`/`$derived`).

```typescript
class CurrentAppStore {
  appPath = $state<string | null>(null)
  config = $state<AppConfig | null>(null)
  details = $state<AppDetails | null>(null)
  versions = $state<VersionEntry[]>([])
  loading = $state(false)
  error = $state<string | null>(null)
  showArchived = $state(false)

  // Derived
  liveVersion = $derived(this.versions.find(v => v.isLive) ?? null)
  
  historicalVersions = $derived(
    this.versions.filter(v => !v.isLive)
  )
  
  visibleVersions = $derived(
    this.showArchived
      ? this.versions
      : this.versions.filter(v => v.metadata.status !== 'archived')
  )

  // Methods
  async load(appPath: string): Promise<void> { ... }
  async refresh(): Promise<void> { ... }
  async saveDetails(details: AppDetails): Promise<void> { ... }
  async saveConfig(config: Partial<AppConfig>): Promise<void> { ... }
  
  // Version actions — all refresh after completion
  async createNewListing(): Promise<void> { ... }
  async duplicateListing(versionDirName: string, newName: string): Promise<void> { ... }
  async renameListing(versionDirName: string, newName: string): Promise<void> { ... }
  async deleteListing(versionDirName: string): Promise<void> { ... }
  async archiveListing(versionDirName: string): Promise<void> { ... }
  async deleteApp(): Promise<void> { ... }
}

export const currentAppStore = new CurrentAppStore()
```

### Key behaviors:

**`load(appPath)`**: Fetch config, details, and versions in parallel. Set `this.appPath`.

**`createNewListing()`**: 
- If `liveVersion` exists, copy its directory to a new dir named with timestamp-based name (e.g., `listing_YYYYMMDD_HHmmss`)
- If no live version, create empty directory with a fresh `version_metadata.json` (status: 'draft')
- Set the new version as `liveVersionDir` in app_config.json
- Refresh

**`duplicateListing(versionDirName, newName)`**:
- Copy `{appPath}/{versionDirName}` to `{appPath}/{newName}`
- Update the copied `version_metadata.json`: set status to 'draft', update createdAt
- Refresh

**`renameListing(versionDirName, newName)`**:
- Rename directory via `fs:rename-item`
- If renamed version was live (`config.liveVersionDir === versionDirName`), update `app_config.json` to point to new name
- Refresh

**`deleteListing(versionDirName)`**:
- Trash directory via `fs:delete-to-trash`
- If deleted version was live, set `liveVersionDir` to the next newest non-archived version (or null)
- Refresh

**`archiveListing(versionDirName)`**:
- Read version_metadata.json, set status to 'archived', write back
- Refresh

**`deleteApp()`**:
- Trash entire `appPath`
- Navigate to Home (via `goHome()`)

---

## Step 6: Build Components (bottom-up)

### 6a. `src/renderer/src/components/shared/ConfirmDialog.svelte`

Reusable confirmation dialog using `<dialog>` element (same pattern as `AddAppDialog`).

**Props:**
```typescript
interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel?: string    // default: "Confirm"
  confirmDanger?: boolean  // default: false — red button style
  onconfirm: () => void
  oncancel: () => void
}
```

Uses `showModal()` / `close()` via `$effect` watching `open`, same as AddAppDialog.

### 6b. `src/renderer/src/components/dashboard/VersionActions.svelte`

Action buttons for a single version.

**Props:**
```typescript
interface Props {
  version: VersionEntry
}
```

**Actions (buttons):**
- "Edit" — navigates to Store Listing Editor (`goToEditor(appPath, versionDirName)`)
- "Set as Live" — shown only if not already live; calls `currentAppStore.saveConfig({ liveVersionDir: version.dirName })`
- "Duplicate" — prompts for name, calls `currentAppStore.duplicateListing()`
- "Rename" — prompts for new name, calls `currentAppStore.renameListing()`
- "Archive" — calls `currentAppStore.archiveListing()` (only if status !== 'archived')
- "Delete" — opens ConfirmDialog, calls `currentAppStore.deleteListing()`

Use a simple inline prompt (input + confirm/cancel) for name inputs, or reuse the dialog pattern.

### 6c. `src/renderer/src/components/dashboard/VersionCard.svelte`

Displays a single version as a card.

**Props:**
```typescript
interface Props {
  version: VersionEntry
}
```

**Display:**
- Directory name as title
- "LIVE" badge if `version.isLive`
- Status badge (draft/published/archived) with color coding
- Created date (formatted from `version.metadata.createdAt`)
- Custom notes (truncated if long)
- `VersionActions` component at the bottom

### 6d. `src/renderer/src/components/dashboard/AppDetailsForm.svelte`

Editable form for `app_details.json` fields.

**Props:**
```typescript
interface Props {
  details: AppDetails
  onsave: (details: AppDetails) => void
}
```

**Fields:**
- Default Language (text input)
- Contact Email (text input)
- Contact Website (text input)
- Contact Phone (text input)
- Privacy Policy URL (text input)

**Behavior:**
- Local copy of details for editing (not bound directly to store)
- "Save" button (disabled when no changes or while saving)
- Tracks dirty state by comparing with original
- On save, calls `onsave(editedDetails)`

### 6e. `src/renderer/src/screens/AppDashboard.svelte`

Main dashboard screen.

**Layout:**
```
┌──────────────────────────────────────────┐
│ App Name              [Screenshot Mgr]   │
│ Package: com.example.app  [Delete App]   │
├──────────────────────────────────────────┤
│ App Details Form (collapsible)           │
│ ┌─ Default Language ──────────────┐      │
│ │ Contact Email, Website, etc.    │      │
│ └─ [Save] ────────────────────────┘      │
├──────────────────────────────────────────┤
│ Store Listing Versions                   │
│ [+ New Listing]  □ Show Archived         │
│                                          │
│ ┌ v2_release ─── LIVE ── draft ─────┐   │
│ │ Created: ...  │ Edit │ Dup │ ... │ │   │
│ └────────────────────────────────────┘   │
│ ┌ v1_initial ── published ──────────┐   │
│ │ Created: ...  │ Edit │ Dup │ ... │ │   │
│ └────────────────────────────────────┘   │
└──────────────────────────────────────────┘
```

**Script:**
- On mount, load `currentAppStore.load(route.appPath)`
- Pass `currentAppStore.config.appName` to Header (via prop or store)
- Wire all action handlers through the store

---

## Step 7: Wire App.svelte

Replace the dashboard placeholder in `App.svelte`:

```svelte
{:else if route.screen === 'dashboard'}
  <AppDashboard />
```

Import `AppDashboard` from `./screens/AppDashboard.svelte`.

The `Header` component already handles the dashboard breadcrumb. It uses `appName` prop — the `AppDashboard` should update this. Currently Header accepts `appName` as a prop. We need to pass it from App.svelte. Since the `currentAppStore` will have the loaded config, we can derive `appName` from it and pass to Header.

Update `App.svelte` Header usage:
```svelte
<Header appName={currentAppStore.config?.appName} />
```

---

## Implementation Order

1. **Types** — models.ts, ipc-channels.ts, ipc-payloads.ts
2. **Backend** — filesystem.ts service functions
3. **IPC** — fs-handlers.ts new handlers
4. **Bridge** — preload/index.ts + env.d.ts + ipc.ts
5. **Store** — current-app.svelte.ts
6. **Components** — ConfirmDialog → VersionActions → VersionCard → AppDetailsForm → AppDashboard
7. **Wiring** — App.svelte integration + Header appName prop

---

## Edge Cases & Decisions

- **Deleting the live version**: Reassign `liveVersionDir` to the newest remaining non-archived version. If none remain, set to `null`.
- **Renaming the live version**: Update `liveVersionDir` in app_config.json to the new name.
- **New Listing when no versions exist**: Create an empty version directory with just `version_metadata.json`.
- **New Listing when versions exist**: Copy the live version (or latest if no live). Set the new copy as live.
- **Version name validation**: No filesystem-invalid chars (`/\\:*?"<>|`), no empty, no duplicates.
- **Archive doesn't delete**: Just changes status in metadata. Show Archived toggle controls visibility.
- **Delete App**: Requires confirmation dialog. Trashes entire app directory and navigates home.

---

## Verification

1. `npm run dev` — app launches without errors
2. Navigate Home → click app card → Dashboard loads with app details and versions
3. Edit app details → Save → reopen → changes persisted
4. Create New Listing → version appears as live
5. Duplicate Listing → copy appears with new name
6. Rename Listing → name changes, live pointer updated if needed
7. Archive Listing → version hidden unless "Show Archived" checked
8. Delete Listing → version trashed, live reassigned
9. Delete App → confirmation → app trashed → back to Home
10. `npx svelte-check` — no type errors
11. `npx tsc --noEmit -p tsconfig.node.json` — no type errors
