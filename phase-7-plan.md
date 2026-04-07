# Phase 7: Google Play API Integration — Detailed Implementation Plan

## Context

Phases 1–6 are complete. The app has workspace management, app CRUD, store listing editing, screenshot management, and a validation engine. Phase 7 adds the ability to **publish** local store listing data to Google Play and **import** live data from Google Play, with real-time progress reporting. The `googleapis` package (v144) is already installed.

---

## Files to Create (8 new files)

| # | File | Purpose |
|---|------|---------|
| 1 | `src/main/services/google-play/auth.ts` | GoogleAuth client creation + caching |
| 2 | `src/main/services/google-play/image-diff.ts` | SHA-256 hash comparison for smart image sync |
| 3 | `src/main/services/google-play/publish.ts` | Full publish transaction with progress callbacks |
| 4 | `src/main/services/google-play/import.ts` | Read-only import from Google Play |
| 5 | `src/main/ipc/api-handlers.ts` | IPC handlers for api:publish, api:import-live |
| 6 | `src/renderer/src/stores/progress.svelte.ts` | Reactive progress state store |
| 7 | `src/renderer/src/components/shared/ProgressPanel.svelte` | Progress step list UI component |
| 8 | `src/renderer/src/components/home/ImportAppDialog.svelte` | Import dialog for Home screen |

## Files to Modify (10 existing files)

| # | File | Changes |
|---|------|---------|
| 9 | `src/shared/types/models.ts` | Add ProgressStep, ProgressEvent types |
| 10 | `src/shared/types/ipc-channels.ts` | Add API_PUBLISH, API_IMPORT_LIVE, API_PROGRESS channels |
| 11 | `src/shared/types/ipc-payloads.ts` | Add ApiPublishRequest, ApiImportLiveRequest, response types |
| 12 | `src/main/constants.ts` | Add IMAGE_FILE_TO_API_TYPE mapping |
| 13 | `src/main/index.ts` | Import + call registerApiHandlers() |
| 14 | `src/preload/index.ts` | Add publish, importLive, onApiProgress methods |
| 15 | `src/renderer/src/env.d.ts` | Add new Api interface methods |
| 16 | `src/renderer/src/lib/ipc.ts` | Add publish, importLive, onApiProgress wrappers |
| 17 | `src/renderer/src/screens/AppDashboard.svelte` | Add ProgressPanel, Import button, Publish wiring |
| 18 | `src/renderer/src/screens/HomeGrid.svelte` | Add "Import from Play Console" card + dialog |

---

## Implementation Steps

### Step 1: Shared Types (`src/shared/types/models.ts`)

Add at the end:

```typescript
// --- Phase 7: Google Play API Integration types ---

export interface ProgressStep {
  id: string              // e.g. 'edit-insert', 'locale-en-US-text'
  label: string           // Human-readable: "Inserting edit..."
  status: 'pending' | 'active' | 'done' | 'error'
  error?: string
}

export interface ProgressEvent {
  operationType: 'publish' | 'import'
  steps: ProgressStep[]
  finished: boolean
  abortError?: string     // Top-level fatal error
}
```

### Step 2: IPC Channels (`src/shared/types/ipc-channels.ts`)

Add channel constants:

```typescript
// API channels
export const API_PUBLISH = 'api:publish' as const
export const API_IMPORT_LIVE = 'api:import-live' as const
export const API_PROGRESS = 'api:progress' as const
```

Add all three to the `IpcChannel` union type.

### Step 3: IPC Payloads (`src/shared/types/ipc-payloads.ts`)

Add import for `ProgressEvent` from models, then:

```typescript
// api:publish
export interface ApiPublishRequest {
  packageName: string
  serviceAccountKeyPath: string
  versionDir: string       // Absolute path to the version directory
  appPath: string          // Absolute path to app dir (for app_details.json)
}
export type ApiPublishResponse = IpcResult<void>

// api:import-live
export interface ApiImportLiveRequest {
  packageName: string
  serviceAccountKeyPath: string
  targetDir: string        // Where to write imported data
  mode: 'new-app' | 'overwrite-version'
}
export type ApiImportLiveResponse = IpcResult<void>
```

### Step 4: Constants (`src/main/constants.ts`)

Add mapping for non-screenshot image files to API image types:

```typescript
export const IMAGE_FILE_TO_API_TYPE: Record<string, string> = {
  'high_res_icon.png': 'icon',
  'feature_graphic.png': 'featureGraphic',
  'tv_banner.png': 'tvBanner'
}
```

### Step 5: Auth Service (`src/main/services/google-play/auth.ts`)

- Read service account JSON key file from disk
- Create `google.auth.GoogleAuth` with scope `https://www.googleapis.com/auth/androidpublisher`
- Cache the `androidpublisher` client instance keyed by file path
- Export: `getAndroidPublisher(keyPath: string): Promise<androidpublisher_v3.Androidpublisher>`

```typescript
import { google } from 'googleapis'
import type { androidpublisher_v3 } from 'googleapis'

let cachedKeyPath: string | null = null
let cachedPublisher: androidpublisher_v3.Androidpublisher | null = null

export async function getAndroidPublisher(keyPath: string): Promise<androidpublisher_v3.Androidpublisher> {
  if (cachedPublisher && cachedKeyPath === keyPath) return cachedPublisher
  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ['https://www.googleapis.com/auth/androidpublisher']
  })
  const client = await auth.getClient()
  cachedPublisher = google.androidpublisher({ version: 'v3', auth: client as any })
  cachedKeyPath = keyPath
  return cachedPublisher
}
```

### Step 6: Image Diff Service (`src/main/services/google-play/image-diff.ts`)

- `computeLocalHash(filePath: string): Promise<string>` — Uses `crypto.createHash('sha256')` on file buffer
- `computeImageDiff(localFiles, apiImages): ImageDiffResult` — Compares hash sets to determine uploads/deletes

```typescript
interface LocalImageEntry { filePath: string; sha256: string }
interface ApiImageEntry { id: string; sha256: string }
interface ImageDiffResult {
  toUpload: string[]   // Local file paths not in API
  toDelete: string[]   // API image IDs not in local
}
```

Logic: Build Set of sha256 hashes from each side. `toUpload` = local entries whose hash is not in API set. `toDelete` = API entries whose hash is not in local set.

### Step 7: Publish Service (`src/main/services/google-play/publish.ts`)

**Signature:**
```typescript
export async function publishToGooglePlay(
  params: { packageName: string; serviceAccountKeyPath: string; versionDir: string; appPath: string },
  onProgress: (event: ProgressEvent) => void
): Promise<void>
```

**Transaction flow** (each step = a ProgressStep):

1. **"Authenticating"** — `getAndroidPublisher(serviceAccountKeyPath)`
2. **"Inserting edit"** — `edits.insert({ packageName, requestBody: {} })` → `editId`
3. **"Updating app details"** — Read `app_details.json` from `appPath`, call `edits.details.update()`
4. **Per-locale** (for each locale directory in `versionDir`):
   - **"Updating [locale] listing text"** — Read `title.txt`, `short_description.txt`, `full_description.txt`, `video_url.txt` → `edits.listings.update()`
   - **"Syncing [locale] images"** — For each image type in `IMAGE_FILE_TO_API_TYPE`: if file exists locally, delete all API images for that type then upload; if not, delete from API
   - **"Syncing [locale] [type] screenshots"** — For each screenshot type in `DIR_TO_API_TYPE`:
     - `edits.images.list()` to get current API images
     - Compute SHA-256 of local screenshots
     - `computeImageDiff()` → delete removed, upload new
5. **"Committing edit"** — `edits.commit({ packageName, editId })`
6. **Post-commit** — Update `version_metadata.json` status to `'published'`

**Error handling:** On any failure, attempt `edits.delete({ packageName, editId })` to clean up, set `abortError` on ProgressEvent, mark step as error.

**Progress helper:** Internal function that maintains a `ProgressEvent` object, updates step statuses, and calls `onProgress()` after each change.

### Step 8: Import Service (`src/main/services/google-play/import.ts`)

**Signature:**
```typescript
export async function importFromGooglePlay(
  params: { packageName: string; serviceAccountKeyPath: string; targetDir: string; mode: 'new-app' | 'overwrite-version' },
  onProgress: (event: ProgressEvent) => void
): Promise<void>
```

**Flow:**

1. **"Authenticating"** — `getAndroidPublisher()`
2. **"Inserting edit (read-only)"** — `edits.insert()` → `editId`
3. **"Fetching app details"** — `edits.details.get()`. If `mode === 'new-app'`, write `app_config.json` + `app_details.json`
4. **"Fetching listings"** — `edits.listings.list()` → array of locale listings
5. **Per-locale:**
   - Create locale directory under `targetDir`
   - Write text files from listing data
   - **"Downloading [locale] images"** — For each image type, `edits.images.list()` → download image URL → save to file
   - **"Downloading [locale] screenshots"** — For each screenshot type, download and save as `01.png`, `02.png`, etc.
6. **Cleanup** — `edits.delete({ packageName, editId })` (no commit for read-only)
7. If `mode === 'new-app'`, write `version_metadata.json` with status `'published'`

**Image download:** Use Node.js `https.get` or `fetch` on the `url` field from images.list response. If auth is required, pass Bearer token via `auth.getAccessToken()`.

### Step 9: IPC Handlers (`src/main/ipc/api-handlers.ts`)

```typescript
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
```

Key: Uses `event.sender.send(API_PROGRESS, ...)` to push progress events to renderer (new pattern for this codebase).

### Step 10: Main Process Init (`src/main/index.ts`)

Add import and registration:
```typescript
import { registerApiHandlers } from './ipc/api-handlers'
// In app.whenReady():
registerApiHandlers()
```

### Step 11: Preload Bridge (`src/preload/index.ts`)

Add to the `contextBridge.exposeInMainWorld('api', { ... })` object:

```typescript
// API
publish: (args: { packageName: string; serviceAccountKeyPath: string; versionDir: string; appPath: string }) =>
  ipcRenderer.invoke(API_PUBLISH, args),
importLive: (args: { packageName: string; serviceAccountKeyPath: string; targetDir: string; mode: string }) =>
  ipcRenderer.invoke(API_IMPORT_LIVE, args),
onApiProgress: (callback: (event: any) => void) => {
  const handler = (_ipcEvent: any, data: any) => callback(data)
  ipcRenderer.on(API_PROGRESS, handler)
  return () => ipcRenderer.removeListener(API_PROGRESS, handler)
},
```

Import `API_PUBLISH`, `API_IMPORT_LIVE`, `API_PROGRESS` from ipc-channels.

### Step 12: Type Declarations (`src/renderer/src/env.d.ts`)

Add to the `Api` interface:

```typescript
// API
publish(args: { packageName: string; serviceAccountKeyPath: string; versionDir: string; appPath: string }): Promise<IpcResult<void>>
importLive(args: { packageName: string; serviceAccountKeyPath: string; targetDir: string; mode: string }): Promise<IpcResult<void>>
onApiProgress(callback: (event: ProgressEvent) => void): () => void
```

Add `ProgressEvent` to the imports from models.

### Step 13: Renderer IPC Wrapper (`src/renderer/src/lib/ipc.ts`)

Add to the `ipc` object:

```typescript
// API
async publish(args: { packageName: string; serviceAccountKeyPath: string; versionDir: string; appPath: string }): Promise<void> {
  return unwrap(await window.api.publish(args))
},

async importLive(args: { packageName: string; serviceAccountKeyPath: string; targetDir: string; mode: string }): Promise<void> {
  return unwrap(await window.api.importLive(args))
},

onApiProgress(callback: (event: ProgressEvent) => void): () => void {
  return window.api.onApiProgress(callback)
}
```

Add `ProgressEvent` to imports from models.

### Step 14: Progress Store (`src/renderer/src/stores/progress.svelte.ts`)

```typescript
import { ipc } from '$lib/ipc'
import type { ProgressEvent } from '$shared/types/models'

class ProgressStore {
  event = $state<ProgressEvent | null>(null)
  active = $derived(this.event !== null && !this.event.finished)
  steps = $derived(this.event?.steps ?? [])
  errors = $derived(this.steps.filter(s => s.status === 'error'))
  hasErrors = $derived(this.errors.length > 0 || !!this.event?.abortError)
  abortError = $derived(this.event?.abortError ?? null)
  finished = $derived(this.event?.finished ?? false)
  operationType = $derived(this.event?.operationType ?? null)

  private unsubscribe: (() => void) | null = null

  subscribe(): void {
    this.unsubscribe = ipc.onApiProgress((ev) => { this.event = ev })
  }

  dismiss(): void {
    if (this.unsubscribe) { this.unsubscribe(); this.unsubscribe = null }
    this.event = null
  }
}

export const progressStore = new ProgressStore()
```

### Step 15: ProgressPanel Component (`src/renderer/src/components/shared/ProgressPanel.svelte`)

- Renders when `progressStore.event` is non-null
- Header: "Publishing to Google Play..." or "Importing from Google Play..."
- Step list with status indicators: spinner (active), checkmark (done), X (error), dot (pending)
- On finish with success: green banner + "Dismiss" button
- On finish with errors: red banner with error details (collapsible) + "Dismiss" button
- Dismiss calls `progressStore.dismiss()`

### Step 16: ImportAppDialog (`src/renderer/src/components/home/ImportAppDialog.svelte`)

- Similar structure to existing `AddAppDialog`
- Single input field: package name (e.g. `com.example.app`)
- Requires `settingsStore.serviceAccountKeyPath` to be set (show warning if not)
- On confirm: calls `progressStore.subscribe()`, then `ipc.importLive({ packageName, serviceAccountKeyPath, targetDir: joinPath(workspacePath, packageName), mode: 'new-app' })`
- Disabled when `progressStore.active`

### Step 17: AppDashboard Changes (`src/renderer/src/screens/AppDashboard.svelte`)

- Import `progressStore` and `ProgressPanel`
- Import `settingsStore` for serviceAccountKeyPath access
- Add "Publish to Play" button in `header-actions` (alongside Screenshot Manager / Delete App)
  - Disabled when: `progressStore.active`, no `serviceAccountKeyPath`, or no `liveVersion`
  - On click: `progressStore.subscribe()`, then call `ipc.publish({ packageName, serviceAccountKeyPath, versionDir: liveVersion.dirPath, appPath })`
  - After publish completes, call `currentAppStore.refresh()` to reload updated metadata
- Add "Import from Play" button in `header-actions`
  - Disabled when: `progressStore.active` or no `serviceAccountKeyPath`
  - On click: show confirm dialog, then `progressStore.subscribe()` + `ipc.importLive({ mode: 'overwrite-version', targetDir: liveVersion.dirPath, ... })`
- Render `<ProgressPanel />` below the header when `progressStore.event !== null`

### Step 18: HomeGrid Changes (`src/renderer/src/screens/HomeGrid.svelte`)

- Add "Import from Play Console" card (dashed border, similar to "Add App" card)
- On click: open `ImportAppDialog`
- After successful import: refresh workspace via `appStateStore.refresh()`
- Disabled when `progressStore.active`

---

## Google Play API Reference

All calls via `google.androidpublisher({ version: 'v3', auth })`:

| Operation | Method | Key Parameters |
|-----------|--------|----------------|
| Insert edit | `edits.insert` | `{ packageName, requestBody: {} }` |
| Get details | `edits.details.get` | `{ packageName, editId }` |
| Update details | `edits.details.update` | `{ packageName, editId, requestBody }` |
| List listings | `edits.listings.list` | `{ packageName, editId }` |
| Update listing | `edits.listings.update` | `{ packageName, editId, language, requestBody }` |
| List images | `edits.images.list` | `{ packageName, editId, language, imageType }` |
| Upload image | `edits.images.upload` | `{ packageName, editId, language, imageType, media: { mimeType, body } }` |
| Delete image | `edits.images.delete` | `{ packageName, editId, language, imageType, imageId }` |
| Delete all images | `edits.images.deleteall` | `{ packageName, editId, language, imageType }` |
| Commit edit | `edits.commit` | `{ packageName, editId }` |
| Delete edit | `edits.delete` | `{ packageName, editId }` |

Image type strings: `'icon'`, `'featureGraphic'`, `'tvBanner'`, `'phoneScreenshots'`, `'sevenInchScreenshots'`, `'tenInchScreenshots'`, `'tvScreenshots'`, `'wearScreenshots'`

---

## Reuse Existing Code

- **`DIR_TO_API_TYPE`** from `src/main/constants.ts` — maps screenshot directory names to API types
- **`IMAGE_SPECS`** from `src/main/constants.ts` — image file names as keys
- **`joinPath()`** helper pattern from `src/renderer/src/stores/current-app.svelte.ts`
- **`ipc.readTextFile()`**, **`ipc.writeJsonFile()`**, **`ipc.copyImage()`** — reuse existing filesystem IPC
- **`ConfirmDialog`** from `src/renderer/src/components/shared/ConfirmDialog.svelte`
- **`AddAppDialog`** pattern from `src/renderer/src/components/home/AddAppDialog.svelte` — follow same structure for ImportAppDialog
- **`settingsStore`** from `src/renderer/src/stores/settings.svelte.ts` — already has `serviceAccountKeyPath`
- **`currentAppStore`** — already has `config.packageName`, `liveVersion`, `refresh()`

---

## Verification

After implementation, verify:

1. `npm run dev` — app launches without errors
2. `npx svelte-check` — no type errors in renderer
3. `npx tsc --noEmit -p tsconfig.node.json` — no type errors in main/preload
4. **With a valid service account key + test app:**
   - Dashboard → "Publish to Play" → progress steps appear → completes → version_metadata.json updated to 'published'
   - Dashboard → "Import from Play" → progress steps → locale dirs populated with text + images
   - Home → "Import from Play Console" → enter package name → new app dir created with imported data
5. **Without service account key:** Publish/Import buttons disabled or show appropriate message
6. **Concurrent guard:** While publish is active, all publish/import buttons across app are disabled
7. **Error handling:** Disconnect network mid-publish → error shown in ProgressPanel → edit cleaned up on API side
