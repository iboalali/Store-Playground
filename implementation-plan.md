# Plan: Implement Store Playground

## Context

Store Playground is a greenfield Electron + Svelte 5 desktop app for managing Google Play Store listing assets. The finalized tech spec is in `tech-document.md`. There is no existing code — this plan covers the full implementation from project scaffolding through all features, built incrementally in 8 phases.

**Tech stack:** Electron, Svelte 5 (runes), electron-vite, TypeScript, chokidar, sharp, image-size, googleapis, electron-builder

---

## Project Structure

```
Store-Playground/
├── src/
│   ├── main/                              # Electron main process
│   │   ├── index.ts                       # Entry: window creation, IPC init, service init
│   │   ├── ipc/
│   │   │   ├── fs-handlers.ts             # fs:* IPC channels (17 handlers)
│   │   │   ├── screenshot-handlers.ts     # screenshots:* IPC channels (1 handler)
│   │   │   ├── api-handlers.ts            # api:* channels (3 handlers)
│   │   │   ├── settings-handlers.ts       # settings:* channels (2 handlers)
│   │   │   └── watcher-handlers.ts        # Watcher event forwarding to renderer
│   │   ├── services/
│   │   │   ├── filesystem.ts              # Workspace read, file CRUD, trash, copy, rename
│   │   │   ├── settings.ts                # Read/write JSON in app.getPath('userData')
│   │   │   ├── watcher.ts                 # chokidar wrapper with debounce + operation lock
│   │   │   ├── validation.ts              # Text/image/screenshot validation (pure functions)
│   │   │   ├── image-utils.ts             # sharp/image-size dimension + format checks
│   │   │   └── google-play/
│   │   │       ├── auth.ts                # Service account auth + client caching
│   │   │       ├── publish.ts             # Publish transaction flow
│   │   │       ├── import.ts              # Import live data flow
│   │   │       └── image-diff.ts          # SHA-256 smart diff logic
│   │   ├── menu.ts                        # Menu bar template + shortcuts
│   │   └── constants.ts                   # BCP-47 locales, text limits, image specs
│   │
│   ├── preload/
│   │   └── index.ts                       # contextBridge.exposeInMainWorld('api', ...)
│   │
│   ├── shared/                            # Cross-process type contracts
│   │   └── types/
│   │       ├── models.ts                  # AppConfig, AppDetails, VersionMetadata, ScreenshotConfig, ScreenMeta, etc.
│   │       ├── ipc-channels.ts            # String literal unions for all channel names
│   │       └── ipc-payloads.ts            # Request/response types per channel + IpcResult<T>
│   │
│   └── renderer/
│       ├── index.html
│       └── src/
│           ├── App.svelte                 # Layout shell + router switch
│           ├── main.ts                    # Svelte mount point
│           ├── router.svelte.ts           # State-based router (no library needed)
│           ├── lib/
│           │   ├── ipc.ts                 # Typed wrapper around window.api
│           │   └── locale-names.ts        # BCP-47 tag → human-readable name map
│           ├── stores/
│           │   ├── app-state.svelte.ts    # Workspace apps list
│           │   ├── current-app.svelte.ts  # Selected app + versions
│           │   ├── editor.svelte.ts       # Active listing: locales, texts, images, dirty flags
│           │   ├── screenshot-manager.svelte.ts  # Screenshot versions, screens, variants, drag, undo
│           │   ├── settings.svelte.ts     # Settings mirror
│           │   └── progress.svelte.ts     # Publish/import progress + errors
│           ├── screens/
│           │   ├── HomeGrid.svelte
│           │   ├── AppDashboard.svelte
│           │   ├── StoreListingEditor.svelte
│           │   ├── ScreenshotManager.svelte   # Screenshot library management
│           │   └── Settings.svelte
│           ├── components/
│           │   ├── layout/
│           │   │   ├── Header.svelte      # App header with nav breadcrumbs + gear icon
│           │   │   └── ProgressPanel.svelte
│           │   ├── home/
│           │   │   ├── AppCard.svelte
│           │   │   └── AddAppDialog.svelte
│           │   ├── dashboard/
│           │   │   ├── AppDetailsForm.svelte
│           │   │   ├── VersionCard.svelte
│           │   │   └── VersionActions.svelte
│           │   ├── editor/
│           │   │   ├── LocaleTabs.svelte
│           │   │   ├── TextEditor.svelte  # Textarea with live char count
│           │   │   ├── ImageGrid.svelte
│           │   │   ├── ImageSlot.svelte   # Single image with drop + picker + delete
│           │   │   ├── ScreenshotSection.svelte
│           │   │   ├── ScreenshotPicker.svelte  # Modal to pick from screenshot library
│           │   │   └── LocaleSelector.svelte  # Searchable dropdown for 77 locales
│           │   ├── screenshots/
│           │   │   ├── VersionSelector.svelte   # Dropdown for switching screenshot versions
│           │   │   ├── VersionActions.svelte     # Add/Delete/Rename/Duplicate version
│           │   │   ├── ScreenList.svelte         # Vertical list of screens, drag-reorder
│           │   │   ├── ScreenRow.svelte          # Screen header + variant grid
│           │   │   ├── VariantGrid.svelte        # Horizontal grid of variant slots
│           │   │   ├── VariantSlot.svelte        # Image thumbnail/placeholder, drop zone
│           │   │   └── DragOverlay.svelte        # Visual overlay during drag operations
│           │   └── shared/
│           │       ├── ConfirmDialog.svelte
│           │       ├── Button.svelte
│           │       └── Tooltip.svelte
│           └── assets/
│               ├── default-app-icon.png
│               └── styles/
│                   └── global.css
│
├── resources/
│   └── icon.png                           # App icon for electron-builder
├── electron.vite.config.ts
├── electron-builder.yml
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── tsconfig.web.json
├── svelte.config.js
└── .gitignore
```

## Key Architecture Decisions

### IPC Handler / Service Split
IPC handlers in `src/main/ipc/` are thin dispatchers — they receive args, call a service method, return the result. Services in `src/main/services/` contain all business logic with zero Electron imports (pure Node.js, testable without mocking Electron).

### Svelte 5 State Management
Stores use `.svelte.ts` files (required for runes). Each store exports a class-based singleton using `$state` for reactive fields and `$derived` for computed values. Objects are mutated, not reassigned, to maintain cross-module reactivity.

### Router
State-based, no library. A single `router.svelte.ts` exports a `$state<Route>` with discriminated union types. `App.svelte` renders via `{#if}/{:else if}`. 4 screens only — a library would be overhead.

### Preload Bridge
`contextBridge.exposeInMainWorld('api', {...})` exposes typed methods. Renderer accesses via `lib/ipc.ts` wrapper (single mock point). Push events (watcher, progress) use `ipcRenderer.on()` with subscription functions returning unsubscribe callbacks, cleaned up via `$effect`.

### Shared Types
`src/shared/types/` defines all cross-process contracts (data models, IPC channel names, request/response payloads). Imported by both main and renderer via TypeScript path aliases.

---

## Implementation Phases

### Phase 1: Project Scaffolding
**Goal:** A running Electron window with Svelte rendering "Hello World"

- `npm init` + install dependencies
- Create `electron.vite.config.ts` with `externalizeDepsPlugin()` for main/preload + `svelte()` for renderer
- Create `src/main/index.ts` — minimal BrowserWindow creation
- Create `src/preload/index.ts` — empty contextBridge
- Create `src/renderer/index.html` + `src/renderer/src/main.ts` + `App.svelte`
- Create `tsconfig.json`, `tsconfig.node.json`, `tsconfig.web.json`, `svelte.config.js`
- Create `.gitignore` (node_modules, out, dist, .env, .DS_Store)
- Verify `npm run dev` launches a working window

**Dependencies:**
- Runtime: `chokidar`, `googleapis`, `image-size`, `sharp`
- Dev: `electron`, `electron-vite`, `electron-builder`, `@sveltejs/vite-plugin-svelte`, `svelte`, `typescript`, `svelte-check`, `@electron-toolkit/preload`, `@electron-toolkit/utils`

### Phase 2: Settings + Navigation Infrastructure
**Goal:** Working settings page, router, and header

- Create `src/shared/types/models.ts` — AppConfig, AppDetails, VersionMetadata types
- Create `src/shared/types/ipc-channels.ts` + `ipc-payloads.ts`
- Create `src/renderer/src/router.svelte.ts` with Route union type
- Create `src/renderer/src/stores/settings.svelte.ts`
- Create `src/main/services/settings.ts` — read/write settings.json in userData
- Create `src/main/ipc/settings-handlers.ts` — `settings:get`, `settings:set`
- Wire preload bridge for settings + native dialog channels
- Build `Settings.svelte` — workspace directory picker, service account key picker
- Build `Header.svelte` — breadcrumb nav + gear icon
- Build `App.svelte` — router switch rendering screens, redirect to Settings if no workspace

### Phase 3: Home Grid (Screen 1)
**Goal:** App grid with add/import actions

- Create `src/main/services/filesystem.ts` — `readWorkspace()`, `readAppConfig()`, `createDirectory()`, `writeJsonFile()`, `copyImage()`, `trashItem()`
- Create `src/main/ipc/fs-handlers.ts` — register all fs:* channels
- Wire preload bridge for all fs channels
- Create `src/renderer/src/stores/app-state.svelte.ts` — apps list, loadWorkspace()
- Build `HomeGrid.svelte`, `AppCard.svelte`, `AddAppDialog.svelte`
- Bundle `default-app-icon.png` in assets
- Add App flow: dialog -> create folder + app_config.json + app_details.json + icon
- Navigation: click card -> router to dashboard

### Phase 4: App Dashboard (Screen 2)
**Goal:** Full dashboard with all version CRUD actions

- Create `src/renderer/src/stores/current-app.svelte.ts` — config, details, versions list with $derived for liveVersion, historicalVersions, visibleVersions (archive filter)
- Build `AppDashboard.svelte`, `AppDetailsForm.svelte`, `VersionCard.svelte`, `VersionActions.svelte`
- Build `ConfirmDialog.svelte` (shared, reusable)
- Implement all dashboard actions via IPC:
  - New Listing: fs:copy-directory + new version_metadata.json
  - Duplicate Listing: fs:copy-directory with user-provided name
  - Rename Listing: fs:rename-files + update liveVersionDir if needed
  - Delete Listing: fs:delete-to-trash + handle liveVersionDir reassignment
  - Archive Listing: fs:write-json-file (status -> archived)
  - Delete App: fs:delete-to-trash + navigate back to Home
- Show Archived toggle
- Global settings form bound to app_details.json with save

### Phase 5: Store Listing Editor (Screen 3)
**Goal:** Full editor with text, images, and locale management

- Create `src/renderer/src/stores/editor.svelte.ts` — multi-locale state, texts, images, dirty flags, char counts
- Create `src/renderer/src/lib/locale-names.ts` — 77 locale map
- Build `StoreListingEditor.svelte`, `LocaleTabs.svelte`, `TextEditor.svelte` (textarea + live char counter)
- Build `ImageGrid.svelte`, `ImageSlot.svelte` (drop zone + file picker + delete), `ScreenshotSection.svelte`
- Build `LocaleSelector.svelte` — searchable dropdown
- Implement:
  - Text editing: load .txt files -> textarea -> Ctrl+S saves via fs:write-text-file
  - Video URL input
  - Image add: file picker or drag-drop -> validate -> fs:copy-image
  - Image reorder: drag in grid -> fs:rename-files (01_, 02_, ...)
  - Image delete: fs:delete-to-trash
  - Add Localization: LocaleSelector -> fs:create-directory with empty .txt files + image folders
  - Duplicate Localization: LocaleSelector -> fs:copy-directory
  - Delete Localization: ConfirmDialog -> fs:delete-to-trash

### Phase 5.5: Screenshot Management (Screen 4)
**Goal:** A dedicated screenshot library page with version/screen/variant management and drag-and-drop

**Data Model — File System Structure:**
```
/{app_root}/screenshots/
├── screenshot_config.json             # Version order + per-version screen order
├── .undo/                             # Single backup image for undo (at most one file)
└── /versions/
    └── /{version_name}/               # e.g., "Initial_Set"
        └── /{screen_slug}/            # e.g., "login" (kebab-case from display name)
            ├── _screen.json           # { displayName, variantOrder, variantNames }
            ├── light-mode.png         # Variant image (slug from variant name)
            └── dark-mode.png
```

**Config schemas:**

`screenshot_config.json`:
```json
{
  "versionOrder": ["Holiday_Update", "Initial_Set"],
  "versions": {
    "Initial_Set": {
      "createdAt": "2026-04-01T10:00:00Z",
      "screenOrder": ["login", "home", "settings"]
    }
  }
}
```

`_screen.json` (per screen directory):
```json
{
  "displayName": "Login",
  "variantOrder": ["light-mode", "dark-mode", "spanish"],
  "variantNames": {
    "light-mode": "Light Mode",
    "dark-mode": "Dark Mode",
    "spanish": "Spanish"
  }
}
```

**Shared Types — add to `src/shared/types/models.ts`:**
- `ScreenshotConfig` — versionOrder, versions map (createdAt, screenOrder)
- `ScreenMeta` — displayName, variantOrder, variantNames map
- `ScreenData` — slug, displayName, variants array
- `VariantData` — slug, displayName, hasImage, imagePath

**New IPC channels:**
- `fs:rename-directory` — rename a directory (`fs.renameSync`)
- `fs:move-file` — move a file between locations (`fs.renameSync`)
- `fs:read-json-file` — generic JSON file reader
- `screenshots:list-screens` — composite read: returns all screens with variants and image paths for a version

**New IPC handler file:** `src/main/ipc/screenshot-handlers.ts` for `screenshots:list-screens`; the `fs:*` channels go in existing `fs-handlers.ts`.

**Route — add to `router.svelte.ts`:**
```typescript
| { screen: 'screenshots'; appPath: string }
```
5 screens total. Breadcrumb: Home > App Name > Screenshot Manager.

**Store — create `src/renderer/src/stores/screenshot-manager.svelte.ts`:**
- State: config, currentVersionName, screens array, dragSource, undoAction
- Methods: version CRUD (add copies latest, duplicate copies current), screen CRUD (add/delete/rename/reorder), variant CRUD (add/delete/rename/reorder), image set/move/clear, undo
- Undo: stores one reversible action; old image backed up to `screenshots/.undo/`; cleared on each new action

**Components — build bottom-up:**
1. `VariantSlot.svelte` — image thumbnail or empty placeholder; supports file picker, external drag-and-drop, inter-slot drag, delete/clear
2. `VariantGrid.svelte` — horizontal row of VariantSlots + "Add Variant" button; supports drag-reorder of variants
3. `ScreenRow.svelte` — screen display name header with rename/delete actions + drag handle + VariantGrid
4. `ScreenList.svelte` — vertical list of ScreenRows; supports drag-reorder of screens
5. `VersionSelector.svelte` — dropdown showing all screenshot versions (latest first)
6. `VersionActions.svelte` — Add (copies latest), Duplicate This, Delete, Rename buttons
7. `DragOverlay.svelte` — semi-transparent thumbnail following cursor during drag
8. `ScreenshotManager.svelte` — top-level screen: VersionSelector + VersionActions at top, ScreenList below, floating undo button

**Drag and drop — HTML5 DnD API (no library):**
- External file drop onto VariantSlot: `event.dataTransfer.files[0]` → validate → `fs:copy-image` → old image saved to `.undo/`
- Inter-slot drag (within or across screens): `draggable="true"` on slots with images; on drop, `fs:move-file` to move/swap images
- Reorder screens: drag handles on ScreenRow; updates `screenOrder` in `screenshot_config.json` (metadata only, no files moved)
- Reorder variants: drag handles on VariantSlot labels; updates `variantOrder` in `_screen.json` (metadata only)

**"Add Variant" language integration:**
- Dialog offers: (1) languages from app's listing (reads locale dirs from `liveVersionDir`, shown first), (2) full 77-locale list below, (3) custom name free text input
- Uses existing `locale-names.ts` for human-readable names

**Screenshot version management:**
- Not tied to APK or listing versions — independent naming
- "New Version" copies the latest version as starting point
- "Duplicate This Version" copies the currently viewed version
- Versions can be renamed and deleted

**Undo:**
- Single-level only (latest change)
- Floating undo button appears when an undo action is available
- Covers: image replacement, image move/swap, image deletion
- Does NOT cover structural changes (screen/variant/version add/delete)

**ScreenshotPicker integration (in Store Listing Editor):**
- Add `ScreenshotPicker.svelte` modal to `src/renderer/src/components/editor/`
- Add "Pick from Library" button in `ScreenshotSection.svelte` alongside existing file picker
- Picker shows latest screenshot version by default, with dropdown for older versions
- Screens displayed as collapsible sections, variants as thumbnail grid
- Clicking a thumbnail closes the modal; the selected image is **appended** to the listing's screenshot list as the next numbered file (e.g., `03_picked.png`) via existing `fs:copy-image`

**Navigation:**
- "Screenshot Manager" button on `AppDashboard.svelte` navigates to `{ screen: 'screenshots', appPath }`

### Phase 6: Validation Engine
**Goal:** Pre-flight validation gating the Publish button

- Create `src/main/services/validation.ts` — pure functions:
  - `validateText(type, content)` — char limits from constants.ts
  - `validateImage(filePath, expectedType)` — dimensions, format, file size via image-utils.ts
  - `validateScreenshotCount(type, count)` — per-type min/max
  - `validateVideoUrl(url)` — URL format check
  - `validateVersionForPublish(versionDir)` — orchestrates all checks, returns report
- Create `src/main/services/image-utils.ts` — sharp for format/alpha, image-size for dimensions
- Create `src/main/constants.ts` — 77 locales, text limits, image specs, screenshot limits, dir->API type map
- Wire validation into editor: inline feedback (red borders, char count color change)
- Publish button disabled until all validations pass, with tooltip showing what's failing

### Phase 7: Google Play API Integration
**Goal:** Working publish and import flows with progress

- Create `src/main/services/google-play/auth.ts` — GoogleAuth from service account key, cached client
- Create `src/main/services/google-play/image-diff.ts` — SHA-256 local hash vs API sha256 field, compute add/delete sets
- Create `src/main/services/google-play/publish.ts` — full transaction: edits.insert -> details.update -> per-locale listings.update + image diff + images.upload -> edits.commit -> post-commit hooks
- Create `src/main/services/google-play/import.ts` — read-only snapshot: edits.insert -> details.get -> listings.list -> per-locale text/image download -> no commit
- Create `src/main/ipc/api-handlers.ts` — api:publish, api:import-live; emit progress via webContents.send
- Create `src/renderer/src/stores/progress.svelte.ts` — steps, errors, active flag
- Build `ProgressPanel.svelte` — inline progress steps + collapsible error panel
- Concurrent operation guards: disable buttons during active operation
- Import from Play Console on Home screen (reuses import.ts targeting new app dir)
- Import overwrite in Editor (reuses import.ts targeting current version dir)

### Phase 8: File Watching, Menu Bar & Polish
**Goal:** Complete application with all finishing touches

- Create `src/main/services/watcher.ts` — chokidar.watch with 300ms debounce, pause/resume for operation lock
- Create `src/main/ipc/watcher-handlers.ts` — forward events to renderer
- Wire watcher subscriptions in App.svelte via $effect (auto-refresh affected stores)
- Create `src/main/menu.ts` — full menu template (File, Edit, View, Actions, Help) with accelerators
- Menu actions that trigger renderer operations send via webContents.send('menu:action', name)
- Keyboard shortcuts per spec (Ctrl+S, Ctrl+N, F5, Ctrl+,, Delete, Ctrl+Shift+P, Ctrl+Shift+I, Ctrl+L)
- Loading states, empty states, error states for all screens
- Create `electron-builder.yml` — targets for Win/Mac/Linux, asarUnpack for sharp
- Test packaging with `npm run build` + electron-builder

---

## Verification

After each phase, verify by:
1. `npm run dev` — app launches without errors
2. Manual testing of all features added in that phase
3. `npx svelte-check` — no type errors in renderer
4. `npx tsc --noEmit -p tsconfig.node.json` — no type errors in main/preload

End-to-end verification after Phase 8:
1. Launch app -> Settings -> set workspace path -> Home Grid shows apps
2. Add App -> appears in grid -> click -> Dashboard loads
3. Create/Duplicate/Rename/Archive/Delete versions
4. Dashboard -> Screenshot Manager -> create first version -> add screens -> add variants -> add images
5. Drag screenshots between variants and screens -> undo works
6. Create new screenshot version (copies latest) -> switch between versions
7. Open Editor -> edit text -> see char counts -> add/reorder/delete images
8. Editor -> "Pick from Library" -> pick screenshot from library -> appended to list
9. Add/Duplicate/Delete localizations
10. (With service account) Import live data, Publish with progress
11. Edit a .txt file externally -> UI auto-refreshes
12. Keyboard shortcuts and menu bar all functional
13. Package with electron-builder -> built app launches correctly
