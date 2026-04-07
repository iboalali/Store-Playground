# Phase 5.5: Screenshot Management - Implementation Plan

## Context

Phase 5.5 adds a dedicated Screenshot Manager screen (Screen 4) to the Store Playground app. The screenshot library is per-app but independent of store listing versions -- users manage screenshot "versions" (e.g., "Holiday Update", "Initial Set"), each containing screens (e.g., "Login", "Home"), each containing variants (e.g., "Light Mode", "Dark Mode", "Spanish"). The Store Listing Editor can then pick images from this library via a modal.

Phases 1-5 are complete. The route, navigation button, breadcrumbs, and placeholder already exist. No new IPC channels are needed -- all filesystem operations compose from existing `ipc.*` primitives.

---

## File System Structure

```
/{app_root}/screenshots/
├── screenshot_config.json
├── .undo/
└── /versions/
    └── /{version_name}/
        └── /{screen_slug}/
            ├── _screen.json
            ├── light-mode.png
            └── dark-mode.png
```

---

## Implementation Steps

### Step 1: Add Shared Types to `src/shared/types/models.ts`

Append after `DirectoryEntry` (line 73):

```ts
// --- Phase 5.5: Screenshot Manager types ---

export interface ScreenshotConfig {
  versionOrder: string[]
  versions: Record<string, { createdAt: string; screenOrder: string[] }>
}

export interface ScreenMeta {
  displayName: string
  variantOrder: string[]
  variantNames: Record<string, string>
}

export interface VariantData {
  slug: string
  displayName: string
  filePath: string
  hasImage: boolean
}

export interface ScreenData {
  slug: string
  displayName: string
  dirPath: string
  variants: VariantData[]
}

export interface VersionData {
  name: string
  createdAt: string
  screens: ScreenData[]
}
```

**Verify:** `npx tsc --noEmit -p tsconfig.web.json` passes.

---

### Step 2: Create Screenshot Manager Store

**Create:** `src/renderer/src/stores/screenshot-manager.svelte.ts`

Class-based singleton (`screenshotManagerStore`) following `editor.svelte.ts` pattern.

**Utility:** `toSlug(displayName: string): string` -- kebab-case conversion for directory/file names.

**State:**
- `appPath`, `screenshotsRoot` (derived), `config: ScreenshotConfig | null`
- `activeVersionName: string | null`, `screens: ScreenData[]`
- `loading`, `error`, `imageTimestamp`
- `undoAction: { label: string; backupPath: string; restoreTo: string } | null`

**Methods:**

*Initialization:*
- `load(appPath)` -- reads/creates `screenshot_config.json`, loads first version
- `ensureScreenshotsDir()` -- creates `screenshots/versions/` and `.undo/` if missing
- `loadVersionScreens(versionName)` -- reads screen dirs, `_screen.json` files, resolves variant images

*Version CRUD:*
- `addVersion(name)` -- copies latest version content (or creates empty), updates config
- `duplicateVersion(sourceName, newName)` -- `ipc.copyDirectory`, updates config
- `deleteVersion(name)` -- `ipc.deleteToTrash`, removes from config, switches to next
- `renameVersion(oldName, newName)` -- `ipc.renameItem` on dir, updates config keys

*Screen CRUD:*
- `addScreen(displayName)` -- creates slug dir + `_screen.json`, updates `screenOrder`
- `deleteScreen(screenSlug)` -- trash dir, remove from `screenOrder`
- `renameScreen(screenSlug, newDisplayName)` -- updates `_screen.json` displayName only (slug/dir stable)
- `reorderScreens(newOrder)` -- updates `screenOrder` in config

*Variant CRUD:*
- `addVariant(screenSlug, displayName)` -- updates `_screen.json` (no image file yet)
- `deleteVariant(screenSlug, variantSlug)` -- deletes image if exists, updates `_screen.json`
- `renameVariant(screenSlug, oldSlug, newDisplayName)` -- renames image file if slug changes, updates `_screen.json`
- `reorderVariants(screenSlug, newOrder)` -- updates `variantOrder` in `_screen.json`

*Image operations:*
- `setVariantImage(screenSlug, variantSlug, sourcePath)` -- backup existing to `.undo/`, `ipc.copyImage`
- `setVariantImageFromData(screenSlug, variantSlug, base64)` -- backup existing, `ipc.writeImageData`
- `clearVariantImage(screenSlug, variantSlug)` -- backup to `.undo/`, delete
- `moveVariantImage(fromScreen, fromVariant, toScreen, toVariant)` -- backup dest to `.undo/`, rename source

*Undo:*
- `undo()` -- copies `.undo/{file}` back to `restoreTo`, clears `undoAction`
- `backupForUndo(filePath, label)` -- clears `.undo/`, copies file in

*Helpers:*
- `saveConfig()` -- writes `screenshot_config.json`
- `saveScreenMeta(screenSlug, meta)` -- writes `_screen.json`

**Verify:** Import store, call `load()` with an app path, confirm config file created.

---

### Step 3: Build Components (bottom-up)

All in `src/renderer/src/components/screenshots/`.

#### 3a: `VariantSlot.svelte`

Single variant image slot. Shows thumbnail if `hasImage`, else dashed placeholder with "+".

Props: `variant: VariantData`, `imageTimestamp`, event callbacks (`onpick`, `onclear`, `ondragstart`, `ondrop`, `onexternaldrop`)

Features:
- `draggable="true"` when has image
- `dataTransfer.setData('text/x-variant', JSON.stringify({screenSlug, variantSlug}))` on drag start
- Accepts external file drops (`e.dataTransfer.files[0].path`)
- Accepts internal drops (reads `text/x-variant` for move/swap)
- Clipboard paste (same pattern as `ScreenshotSection.svelte`)
- Delete button on hover overlay
- Variant display name below image

#### 3b: `VariantGrid.svelte`

Horizontal scrollable row of `VariantSlot`s + "Add Variant" button.

Props: `screen: ScreenData`, `imageTimestamp`, event callbacks for variant operations

Features:
- Renders `{#each screen.variants as variant (variant.slug)}`
- Drag reorder of variant positions (updates `variantOrder`)
- "Add Variant" dashed button at end

#### 3c: `ScreenRow.svelte`

One screen row: header bar + `VariantGrid`.

Props: `screen: ScreenData`, `imageTimestamp`, `draggable`, screen-level + variant-level event callbacks

Features:
- Drag handle (grip icon) for screen reorder
- Editable display name (click to rename)
- Delete button with confirmation
- `VariantGrid` below header

#### 3d: `ScreenList.svelte`

Vertical list of `ScreenRow`s with drag-to-reorder.

Props: `screens: ScreenData[]`, `imageTimestamp`, all event handlers (pass-through)

Features:
- HTML5 DnD for screen row reorder
- Visual drop indicator between rows
- Tracks `dragOverIdx` for insertion point

#### 3e: `VersionSelector.svelte`

Top bar with version tabs and action buttons.

Props: `versions: string[]`, `activeVersion`, `onselect`, `onadd`, `onduplicate`, `onrename`, `ondelete`

Features:
- Tab buttons for each version (following `LocaleTabs.svelte` pattern)
- "+" button to add new version
- Dropdown/menu for Duplicate, Rename, Delete on active version

#### 3f: `DragOverlay.svelte` (optional, low priority)

Semi-transparent thumbnail following cursor during drag. Uses HTML5 `dragImage` API. Can be deferred to polish phase.

**Verify:** Each component renders in isolation with mock data.

---

### Step 4: Build ScreenshotManager Screen

**Create:** `src/renderer/src/screens/ScreenshotManager.svelte`

Layout:
```
<main>
  {#if loading} ... {/if}
  {#if error} ... {/if}
  <VersionSelector ... />
  <div class="toolbar">
    <button>Add Screen</button>
  </div>
  <ScreenList ... />
  {#if undoAction}
    <button class="undo-fab">Undo: {undoAction.label}</button>
  {/if}
  <ConfirmDialog ... /> (for deletions)
</main>
```

Key behavior:
- `$effect` calls `screenshotManagerStore.load(appPath)` using `appPath` from route
- Gets `appPath` via `getRoute()` (same pattern as `StoreListingEditor.svelte`)
- Wires all child component events to store methods
- Manages dialog state for confirmations and inline rename inputs
- `Ctrl+Z` keyboard shortcut for undo
- Empty state when no versions exist

---

### Step 5: Wire into App.svelte

**Modify:** `src/renderer/src/App.svelte`

- Add import: `import ScreenshotManager from './screens/ScreenshotManager.svelte'`
- Replace lines 42-44 (placeholder) with: `<ScreenshotManager />`

**Verify:** Navigate from AppDashboard "Screenshot Manager" button. Screen loads without errors.

---

### Step 6: Screenshot Picker for Store Listing Editor

#### 6a: Create `src/renderer/src/components/editor/ScreenshotPicker.svelte`

Modal dialog (native `<dialog>`) that displays the screenshot library for selection.

Props: `open`, `appPath`, `onpick: (filePath: string) => void`, `oncancel`

Features:
- On open, reads `screenshot_config.json` and loads version/screen/variant data (lightweight read, not full store)
- Version selector dropdown (defaults to latest)
- Screen sections with variant thumbnail grids
- Clicking a thumbnail calls `onpick(filePath)` and closes

#### 6b: Modify `src/renderer/src/components/editor/ScreenshotSection.svelte`

Add "Library" button next to the existing "Add" button:
- New prop: `onpickfromlibrary: (() => void) | undefined`
- Button rendered when prop is provided, next to "+" add button

#### 6c: Modify `src/renderer/src/screens/StoreListingEditor.svelte`

- Import `ScreenshotPicker`
- Add state: `showPicker = $state(false)`, `pickerType = $state<ScreenshotType | null>(null)`
- Pass `onpickfromlibrary` callback to each `ScreenshotSection`
- Render `<ScreenshotPicker>` dialog; on pick, call `editorStore.addScreenshot(pickerType, filePath)`

**Verify:** Open Store Listing Editor, click "Library" on a screenshot section, browse and pick, image appears in listing.

---

## Files Summary

**New files (8):**
1. `src/renderer/src/stores/screenshot-manager.svelte.ts`
2. `src/renderer/src/screens/ScreenshotManager.svelte`
3. `src/renderer/src/components/screenshots/VariantSlot.svelte`
4. `src/renderer/src/components/screenshots/VariantGrid.svelte`
5. `src/renderer/src/components/screenshots/ScreenRow.svelte`
6. `src/renderer/src/components/screenshots/ScreenList.svelte`
7. `src/renderer/src/components/screenshots/VersionSelector.svelte`
8. `src/renderer/src/components/editor/ScreenshotPicker.svelte`

**Modified files (4):**
1. `src/shared/types/models.ts` -- add 5 new interfaces
2. `src/renderer/src/App.svelte` -- replace placeholder with component
3. `src/renderer/src/components/editor/ScreenshotSection.svelte` -- add "Library" button
4. `src/renderer/src/screens/StoreListingEditor.svelte` -- wire ScreenshotPicker

**No changes to main process / preload / IPC infrastructure** -- all operations use existing channels.

---

## Key Design Decisions

1. **No new IPC channels** -- compose from existing `ipc.*` primitives (readJsonFile, writeJsonFile, copyImage, deleteToTrash, renameItem, createDirectory, copyDirectory, listDirectory, writeImageData). Matches EditorStore pattern.

2. **Screen slug stability** -- renaming a screen changes only `_screen.json` displayName, not the directory name. Prevents broken paths.

3. **Variant slug = file stem** -- derived from display name via `toSlug()`. Renaming a variant that changes the slug requires renaming the image file on disk.

4. **Single-level undo** -- covers image replace/move/delete only. `.undo/` holds at most one file. Structural operations are not undoable.

5. **DragOverlay deferred** -- HTML5 DnD ghost image is sufficient initially.

---

## Verification

After implementation:
1. `npm run dev` -- app launches without errors
2. Navigate: Dashboard -> Screenshot Manager
3. First visit creates `screenshots/` dir structure + `screenshot_config.json`
4. Add a version -> directory created under `versions/`
5. Add a screen -> slug directory + `_screen.json` created
6. Add a variant -> appears as empty slot
7. Drop/pick image -> image copied, thumbnail shown
8. Drag image between variants -> image moved, undo available
9. Click undo -> image restored
10. Drag-reorder screens -> `screenOrder` updated in config
11. Drag-reorder variants -> `variantOrder` updated in `_screen.json`
12. Rename/delete version, screen, variant -> filesystem + config updated
13. Duplicate version -> full directory copy
14. Store Listing Editor -> "Library" button -> ScreenshotPicker modal -> pick image -> appended to listing
15. `npx svelte-check` -- no type errors
16. `npx tsc --noEmit -p tsconfig.node.json` -- no type errors
