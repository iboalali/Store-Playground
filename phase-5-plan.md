# Phase 5: Store Listing Editor - Implementation Plan

## Context

Phase 5 builds the Store Listing Editor (Screen 3) for the Store Playground Electron + Svelte 5 app. This is the core editing experience where users manage per-locale text fields, images, and screenshots within a version directory. Phases 1-4 are complete (scaffolding, settings/nav, home grid, app dashboard). The editor route already exists as a placeholder in `App.svelte` and is navigated to via the "Edit" button on `VersionActions.svelte`.

**Problem:** Users currently can't edit store listing content. Clicking "Edit" on a version shows a placeholder screen.

**Outcome:** A fully functional editor with locale tabs, text editing with live char counts, image management (icon/feature graphic/TV banner), screenshot sections per device type, and locale CRUD (add/duplicate/delete).

---

## Version Directory Structure (on disk)

```
/{versionDir}/
├── version_metadata.json
└── /{locale}/              (e.g., en-US, ar, de-DE)
    ├── title.txt           (max 30 chars)
    ├── short_description.txt (max 80 chars)
    ├── full_description.txt  (max 4000 chars)
    ├── video_url.txt       (optional URL)
    ├── high_res_icon.png   (512x512, PNG w/ alpha, max 1MB)
    ├── feature_graphic.png (1024x500, JPEG/PNG no alpha, max 1MB)
    ├── tv_banner.png       (1280x720, JPEG/PNG no alpha, max 1MB)
    └── /screenshots/
        ├── /phone/         (01.png, 02.png... 2-8 required)
        ├── /tablet_7/      (01.png... 4-8 when provided)
        ├── /tablet_10/     (01.png... 4-8 when provided)
        ├── /tv/            (01.png... 1-8 when provided)
        └── /wear/          (01.png... 1-8 when provided)
```

---

## Implementation Steps

### Step 1: Add Shared Types to `src/shared/types/models.ts`

Append after the existing `VersionEntry` interface:

```typescript
export type ScreenshotType = 'phone' | 'tablet_7' | 'tablet_10' | 'tv' | 'wear'

export interface LocaleTextFields {
  title: string
  shortDescription: string
  fullDescription: string
  videoUrl: string
}

export interface ScreenshotEntry {
  fileName: string
  filePath: string
}

export interface ScreenshotGroup {
  type: ScreenshotType
  dirPath: string
  screenshots: ScreenshotEntry[]
}

export interface DirectoryEntry {
  name: string
  isDirectory: boolean
}
```

### Step 2: Add IPC Channel Constants to `src/shared/types/ipc-channels.ts`

Add 5 new constants and extend the `IpcChannel` union:

- `FS_READ_TEXT_FILE = 'fs:read-text-file'`
- `FS_WRITE_TEXT_FILE = 'fs:write-text-file'`
- `FS_LIST_DIRECTORY = 'fs:list-directory'`
- `FS_READ_JSON_FILE = 'fs:read-json-file'`
- `FS_WRITE_IMAGE_DATA = 'fs:write-image-data'` - writes base64-encoded image data to a file (for clipboard paste)

### Step 3: Add IPC Payload Types to `src/shared/types/ipc-payloads.ts`

Add request/response pairs for all 5 new channels. Import `DirectoryEntry` from models. Follow the existing `interface + type` pattern.

New payload for clipboard paste:
```typescript
// fs:write-image-data — write base64 image data to disk (clipboard paste)
export interface FsWriteImageDataRequest {
  destPath: string
  base64Data: string    // base64-encoded image bytes (no data: prefix)
}
export type FsWriteImageDataResponse = IpcResult<void>
```

### Step 4: Add Filesystem Service Functions to `src/main/services/filesystem.ts`

Add 4 new exported functions (`writeTextFile` already exists at line 82):

- `readTextFile(filePath: string): Promise<string>` - uses `readFile(filePath, 'utf-8')`
- `listDirectory(dirPath: string): Promise<{ name: string; isDirectory: boolean }[]>` - uses `readdir` with `withFileTypes`
- `readJsonFile(filePath: string): Promise<unknown>` - uses `readFile` + `JSON.parse`
- `writeImageData(destPath: string, base64Data: string): Promise<void>` - uses `writeFile(destPath, Buffer.from(base64Data, 'base64'))`

### Step 5: Register IPC Handlers in `src/main/ipc/fs-handlers.ts`

Add 5 new `ipcMain.handle()` calls inside `registerFsHandlers()` following the same try/catch pattern. Import the new channel constants and payload types. The `FS_WRITE_IMAGE_DATA` handler calls `filesystem.writeImageData(args.destPath, args.base64Data)`.

### Step 6: Wire Preload Bridge in `src/preload/index.ts`

Add 5 new methods to the `window.api` object:
- `readTextFile`, `writeTextFile`, `listDirectory`, `readJsonFile`, `writeImageData`

Import the 5 new channel constants.

### Step 7: Update Window API Types in `src/renderer/src/env.d.ts`

Add 5 new method signatures to the `Api` interface. Import `DirectoryEntry` from models.

```typescript
writeImageData(args: { destPath: string; base64Data: string }): Promise<IpcResult<void>>
```

### Step 8: Add IPC Wrapper Methods to `src/renderer/src/lib/ipc.ts`

Add 5 new async methods to the `ipc` object. Import `DirectoryEntry` from models.

```typescript
async readTextFile(filePath: string): Promise<string>
async writeTextFile(filePath: string, content: string): Promise<void>
async listDirectory(dirPath: string): Promise<DirectoryEntry[]>
async readJsonFile(filePath: string): Promise<unknown>
async writeImageData(destPath: string, base64Data: string): Promise<void>
```

### Step 9: Create Locale Names Map - `src/renderer/src/lib/locale-names.ts` (new file)

Static data file with all 77 Google Play BCP-47 locales:

```typescript
export const LOCALE_NAMES: Record<string, string> = {
  'af': 'Afrikaans',
  'am': 'Amharic',
  'ar': 'Arabic',
  // ... all 77 locales
  'zu': 'Zulu'
}

export const LOCALE_OPTIONS: { tag: string; name: string }[] =
  Object.entries(LOCALE_NAMES)
    .map(([tag, name]) => ({ tag, name }))
    .sort((a, b) => a.name.localeCompare(b.name))
```

### Step 10: Create Editor Store - `src/renderer/src/stores/editor.svelte.ts` (new file)

Class-based singleton following existing store pattern. Key design:

**State fields:**
- `appPath`, `versionDir` - route params
- `locales: string[]` - list of locale directories found
- `activeLocale: string | null` - currently selected locale tab
- `texts: LocaleTextFields` - current text field values (editable)
- `savedTexts: LocaleTextFields` - last-saved values (for dirty detection)
- `images: Record<string, { filePath: string; exists: boolean }>` - icon/feature/tvBanner
- `screenshotGroups: ScreenshotGroup[]` - per-type screenshot data
- `loading`, `saving`, `error` - UI state
- `imageTimestamp: number` - for cache-busting `file://` image URLs

**Derived:**
- `versionPath` - `joinPath(appPath, versionDir)`
- `localePath` - `joinPath(versionPath, activeLocale)`
- `isDirty` - compares `texts` vs `savedTexts`
- `charCounts` - `{ title: N, shortDescription: N, fullDescription: N }`

**Constants:**
```typescript
const TEXT_FILE_MAP = [
  { key: 'title', fileName: 'title.txt', maxLength: 30 },
  { key: 'shortDescription', fileName: 'short_description.txt', maxLength: 80 },
  { key: 'fullDescription', fileName: 'full_description.txt', maxLength: 4000 },
  { key: 'videoUrl', fileName: 'video_url.txt', maxLength: 0 }
]
const SCREENSHOT_TYPES: ScreenshotType[] = ['phone', 'tablet_7', 'tablet_10', 'tv', 'wear']
const IMAGE_FILES = [
  { key: 'icon', fileName: 'high_res_icon.png', label: 'High Res Icon', dimensions: '512x512' },
  { key: 'featureGraphic', fileName: 'feature_graphic.png', label: 'Feature Graphic', dimensions: '1024x500' },
  { key: 'tvBanner', fileName: 'tv_banner.png', label: 'TV Banner', dimensions: '1280x720' }
]
```
Export these constants for component use.

**Methods:**

| Method | Description |
|--------|-------------|
| `load(appPath, versionDir)` | Set route params, call `loadLocales()`, load first locale |
| `loadLocales()` | `ipc.listDirectory(versionPath)` → filter directories only, skip non-locale items |
| `loadLocaleData(locale)` | Set `activeLocale`, call `loadTexts()` + `loadImages()` + `loadScreenshots()` in parallel |
| `loadTexts()` | For each text file, try `ipc.readTextFile()`; catch → empty string. Set both `texts` and `savedTexts` |
| `loadImages()` | List locale dir entries, check which image files exist. Build images record |
| `loadScreenshots()` | For each screenshot type, try `ipc.listDirectory()` on `screenshots/{type}/`; filter image files; sort by name |
| `switchLocale(locale)` | Auto-save if dirty, then `loadLocaleData(locale)` |
| `saveTexts()` | For each changed text field, `ipc.writeTextFile()`. Update `savedTexts` |
| `addImage(key, sourcePath)` | `ipc.copyImage(source, localePath/fileName)`. Bump `imageTimestamp`. Refresh images |
| `addImageFromClipboard(key, base64Data)` | `ipc.writeImageData(localePath/fileName, base64Data)`. Bump `imageTimestamp`. Refresh images |
| `deleteImage(key)` | `ipc.deleteToTrash(filePath)`. Bump `imageTimestamp`. Refresh images |
| `addScreenshot(type, sourcePath)` | Determine next `NN.ext` name. Create dir if needed. `ipc.copyImage()`. Refresh |
| `addScreenshotFromClipboard(type, base64Data)` | Determine next `NN.png` name. Create dir if needed. `ipc.writeImageData()`. Refresh |
| `deleteScreenshot(type, fileName)` | `ipc.deleteToTrash()`. Renumber remaining files (two-pass: rename to `_tmp_NN` then to `NN`). Refresh |
| `reorderScreenshots(type, newOrder)` | Two-pass rename: all to `_tmp_NN.ext`, then all to `NN.ext`. Refresh |
| `addLocale(localeTag)` | Create locale dir + empty .txt files + screenshot subdirs. Refresh. Switch to new locale |
| `duplicateLocale(source, target)` | `ipc.copyDirectory()`. Refresh. Switch to new locale |
| `deleteLocale(localeTag)` | `ipc.deleteToTrash()`. Refresh. Switch to first remaining locale |

**Screenshot renumbering (two-pass):** When deleting `02.png` from `[01, 02, 03]`:
1. Rename `01.png` → `_tmp_01.png`, `03.png` → `_tmp_02.png`
2. Rename `_tmp_01.png` → `01.png`, `_tmp_02.png` → `02.png`

This avoids filename collisions during the rename sequence.

### Step 11: Build Leaf Components

#### 11a. `src/renderer/src/components/editor/TextEditor.svelte` (new)

```typescript
interface Props {
  label: string
  value: string
  maxLength: number       // 0 = no limit (video URL)
  multiline?: boolean     // true for full_description
  placeholder?: string
  oninput: (value: string) => void
}
```
- Renders `<textarea>` if multiline, else `<input>`
- Char count display: `{length}/{maxLength}` (hidden when maxLength=0)
- Count turns red/warning when >= 90% of max, red when over limit
- Calls `oninput` on every keystroke

#### 11b. `src/renderer/src/components/editor/ImageSlot.svelte` (new)

```typescript
interface Props {
  label: string
  dimensions: string
  filePath: string | null
  imageTimestamp: number    // for cache busting
  onpick: () => void
  ondelete: () => void
  onpaste: (base64Data: string) => void  // clipboard paste
}
```
- Empty state: dashed border, label + dimensions text, click calls `onpick()`
- Filled state: image preview via `file://{filePath}?t={imageTimestamp}`, delete button overlay
- **No external drag-drop** (sandbox:true prevents `file.path` access). File picker + clipboard paste.
- **Clipboard paste:** When the slot is focused/hovered and user presses Ctrl+V, reads image from clipboard via `navigator.clipboard.read()` or `paste` event on `clipboardData.items`. Extracts the image blob, converts to base64, calls `onpaste(base64Data)`.
- The slot container is focusable (`tabindex="0"`) to receive paste events.

#### 11c. `src/renderer/src/components/editor/LocaleSelector.svelte` (new)

```typescript
interface Props {
  open: boolean
  title: string                 // "Add Localization" or "Duplicate to..."
  excludeLocales: string[]      // already present, shown dimmed/disabled
  onselect: (localeTag: string) => void
  oncancel: () => void
}
```
- `<dialog>` with `showModal()` pattern (matches ConfirmDialog)
- Search input filters `LOCALE_OPTIONS` by name or tag
- Scrollable list of locale buttons: `{name} - {tag}`
- Already-present locales visually dimmed and disabled
- Click calls `onselect(tag)`, dialog closes

### Step 12: Build Composite Components

#### 12a. `src/renderer/src/components/editor/ImageGrid.svelte` (new)

```typescript
interface Props {
  images: Record<string, { filePath: string; exists: boolean }>
  localePath: string
  imageTimestamp: number
  onaddimage: (key: string, sourcePath: string) => void
  ondeleteimage: (key: string) => void
  onpasteimage: (key: string, base64Data: string) => void
}
```
- Renders 3 `ImageSlot` components in a responsive grid (icon, feature graphic, TV banner)
- Each slot's `onpick` calls `ipc.openFileDialog()` with PNG/JPEG filters, then `onaddimage(key, path)`
- Each slot's `onpaste` calls `onpasteimage(key, base64Data)`
- Uses `IMAGE_FILES` constant for labels/dimensions

#### 12b. `src/renderer/src/components/editor/ScreenshotSection.svelte` (new)

```typescript
interface Props {
  group: ScreenshotGroup
  typeLabel: string             // "Phone", "7\" Tablet", etc.
  maxCount: number              // 8
  imageTimestamp: number
  onadd: (sourcePath: string) => void
  onpaste: (base64Data: string) => void  // clipboard paste
  ondelete: (fileName: string) => void
  onreorder: (orderedFileNames: string[]) => void
}
```
- Section header: type label + count `(N/8)`
- Horizontal scrollable grid of screenshot thumbnails via `file://`
- Each thumbnail has delete button overlay and drag handle
- "+" button at end opens file picker (PNG/JPEG filters)
- **Clipboard paste:** Section container is focusable. On Ctrl+V with image in clipboard, reads image blob, converts to base64, calls `onpaste(base64Data)` which appends a new screenshot.
- **Drag-reorder within grid:** HTML5 DnD on thumbnail elements. `draggable="true"`, track source/target indices, compute new order array, call `onreorder`
- Delete button calls `ondelete(fileName)`
- Add button calls `ipc.openFileDialog()` then `onadd(path)`

#### 12c. `src/renderer/src/components/editor/LocaleTabs.svelte` (new)

```typescript
interface Props {
  locales: string[]
  activeLocale: string | null
  isDirty: boolean
  onswitch: (locale: string) => void
  onadd: () => void
  onduplicate: () => void
  ondelete: () => void
}
```
- Horizontal scrollable container (`overflow-x: auto`, `white-space: nowrap`)
- Each locale tab shows: human-readable name (from `LOCALE_NAMES`) + tag below in smaller text
- Active tab: bottom border `#0066cc`, bold text
- Dirty indicator dot on active tab when `isDirty`
- Right side action buttons: "+" (Add), duplicate icon, delete icon (danger styled)
- Delete disabled when only 1 locale remains

### Step 13: Build the Editor Screen - `src/renderer/src/screens/StoreListingEditor.svelte` (new)

**Layout:**
```
+---------------------------------------------------+
| LocaleTabs (sticky top)                           |
|  [en-US] [ar] [de-DE]    [+ Add] [Dup] [Del]     |
+---------------------------------------------------+
| <scrollable content, max-width: 900px centered>   |
|                                                   |
| Section: Text Fields                              |
|   Title           [input]          18/30          |
|   Short Desc      [input]          55/80          |
|   Full Desc       [textarea]      120/4000        |
|   Video URL       [input]                         |
|   [Save] disabled if !dirty. "Unsaved" if dirty   |
|                                                   |
| Section: Images                                   |
|   [Icon 512x512] [Feature 1024x500] [TV 1280x720]|
|                                                   |
| Section: Phone Screenshots (N/8)                  |
|   [thumb] [thumb] [thumb] ... [+]                 |
|                                                   |
| Section: 7" Tablet Screenshots (N/8)              |
|   [thumb] [thumb] ... [+]                         |
|                                                   |
| Section: 10" Tablet Screenshots (N/8)             |
| Section: TV Screenshots (N/8)                     |
| Section: Wear Screenshots (N/8)                   |
+---------------------------------------------------+
```

**Key behaviors:**
- `$effect` loads editor store when route params change
- `$effect` registers `Ctrl+S` keydown listener with cleanup
- Text inputs bind to `editorStore.texts.*` via `oninput` handlers
- Save button calls `editorStore.saveTexts()`, disabled when `!isDirty || saving`
- Add Locale opens `LocaleSelector` dialog → `editorStore.addLocale(tag)`
- Duplicate Locale opens `LocaleSelector` (title "Duplicate to...") → `editorStore.duplicateLocale(active, tag)`
- Delete Locale opens `ConfirmDialog` → `editorStore.deleteLocale(active)`
- Empty state (no locales): centered message + "Add Localization" button
- Screenshot type labels: `{ phone: 'Phone', tablet_7: '7" Tablet', tablet_10: '10" Tablet', tv: 'TV', wear: 'Wear' }`

### Step 14: Wire into App.svelte

In `src/renderer/src/App.svelte`:
- Add import: `import StoreListingEditor from './screens/StoreListingEditor.svelte'`
- Replace the editor placeholder (lines 38-41) with: `<StoreListingEditor />`

---

## Important Design Decisions

1. **No external file drag-drop, but clipboard paste supported:** `sandbox: true` in `main/index.ts:17` prevents accessing `file.path` on dropped files. Adding images uses either the native file picker dialog or **clipboard paste** (Ctrl+V). Clipboard paste reads image data from `clipboardData.items` as a Blob, converts to base64, and sends to main process via `fs:write-image-data` IPC channel which writes the binary data to disk. Internal drag-reorder (within screenshot grids) works fine since it doesn't involve file paths.

2. **Auto-save on locale switch:** When switching locale tabs with unsaved text changes, the store auto-saves silently rather than prompting. This prevents data loss and is simpler UX.

3. **Image cache busting:** Images displayed via `file://` protocol get cached by Chromium. After any image add/replace/delete, the store bumps `imageTimestamp` and all `<img>` src URLs include `?t={timestamp}`.

4. **Screenshot renumbering:** Uses two-pass rename (all to temp names, then to final names) to avoid collisions. E.g., renaming `03.png` → `02.png` when `02.png` already exists would fail without the temp step.

5. **Missing files handled gracefully:** `readTextFile` failures (missing .txt files) are caught and treated as empty strings. Missing screenshot directories are treated as empty groups. The editor always writes all 4 text files on save regardless of which changed.

---

## Files Modified (existing)

| File | Change |
|------|--------|
| `src/shared/types/models.ts` | Add 5 new types |
| `src/shared/types/ipc-channels.ts` | Add 5 channel constants + extend union |
| `src/shared/types/ipc-payloads.ts` | Add 5 request/response pairs |
| `src/main/services/filesystem.ts` | Add 4 new functions |
| `src/main/ipc/fs-handlers.ts` | Add 5 new handlers + imports |
| `src/preload/index.ts` | Add 5 bridge methods + imports |
| `src/renderer/src/env.d.ts` | Add 5 Api methods + import |
| `src/renderer/src/lib/ipc.ts` | Add 5 wrapper methods + import |
| `src/renderer/src/App.svelte` | Replace editor placeholder, add import |

## Files Created (new)

| File | Purpose |
|------|---------|
| `src/renderer/src/lib/locale-names.ts` | 77 BCP-47 locale → name map |
| `src/renderer/src/stores/editor.svelte.ts` | Editor state management |
| `src/renderer/src/screens/StoreListingEditor.svelte` | Main editor screen |
| `src/renderer/src/components/editor/TextEditor.svelte` | Text field with char count |
| `src/renderer/src/components/editor/ImageSlot.svelte` | Single image slot |
| `src/renderer/src/components/editor/ImageGrid.svelte` | 3-image grid |
| `src/renderer/src/components/editor/ScreenshotSection.svelte` | Per-type screenshot grid |
| `src/renderer/src/components/editor/LocaleTabs.svelte` | Locale tab bar |
| `src/renderer/src/components/editor/LocaleSelector.svelte` | Searchable locale picker dialog |

---

## Verification

After implementation, verify:

1. `npm run dev` - app launches without errors
2. Home → App → click "Edit" on a version → Editor loads (not placeholder)
3. **No locales yet:** empty state with "Add Localization" button appears
4. **Add Locale:** searchable dialog → select `en-US` → locale dir created with empty .txt files and screenshot subdirs
5. **Text editing:** type in fields → char counts update live → "Unsaved changes" appears → Ctrl+S saves → indicator clears
6. **Image add:** click image slot → file picker → image copied → preview appears
7. **Image delete:** click X on image → confirm → image trashed → slot returns to empty
8. **Screenshot add:** click "+" → file picker → screenshot added with next sequential number
9. **Screenshot delete:** click X → file trashed → remaining files renumbered
10. **Screenshot reorder:** drag thumbnail to new position → files renamed correctly
11. **Duplicate Locale:** select target locale → entire directory copied → new tab appears
12. **Delete Locale:** confirm dialog → locale trashed → switches to remaining locale
13. **Locale switch:** click different tab → content loads → previous unsaved changes auto-saved
14. `npx svelte-check` - no type errors in renderer
15. `npx tsc --noEmit -p tsconfig.node.json` - no type errors in main/preload
