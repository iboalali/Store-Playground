# Technical Specification: Store Playground

## 1. Project Overview

A local-first, Electron-based desktop application for managing Google Play Store listing assets (text, metadata, and graphics). The core philosophy is **"File-System-as-Database."** All data is stored in standard local directories, `.txt`, and `.json` files, allowing for seamless external editing, version control via Git, and easy backups.

## 2. Technology Stack

* **Application Framework:** Electron (Node.js + Chromium)
* **Backend Logic:** Node.js (`fs` module for file manipulation)
* **Frontend:** Svelte (compiled, lightweight — minimal runtime overhead for Electron)
* **Image Processing:** `sharp` or `image-size` (for dimension validation)
* **File Watching:** `chokidar` (for real-time detection of external file changes)
* **Google API:** `googleapis` (specifically the Google Play Android Developer API `v3`)
* **Build/Packaging:** `electron-builder` (for cross-platform distribution)

## 3. Electron IPC Architecture

The application follows Electron's process isolation model. The **Main Process** and **Renderer Process** communicate exclusively via typed IPC channels.

### 3.1 Process Responsibilities

* **Main Process** owns: File system access (`fs`), Google Play API calls (`googleapis`), file watching (`chokidar`), native dialogs, menu bar, and application settings.
* **Renderer Process** owns: UI rendering (Svelte components), user input handling, and state management via Svelte stores.

### 3.2 IPC Channels

Channels are grouped by domain. All calls from the Renderer use `ipcRenderer.invoke()` (async request/response). Main-to-Renderer pushes use `webContents.send()`.

**File Operations (Renderer → Main):**
* `fs:read-workspace` — List all app directories in the workspace
* `fs:read-app-config` — Read `app_config.json` for a given app
* `fs:read-app-details` — Read `app_details.json` for a given app
* `fs:read-version-metadata` — Read `version_metadata.json` for a given version
* `fs:read-text-file` — Read a locale text file (title, description, etc.)
* `fs:write-text-file` — Write/save a locale text file
* `fs:write-json-file` — Write/save a JSON config file
* `fs:copy-directory` — Duplicate a version or locale directory (`fs.cpSync`)
* `fs:create-directory` — Create a new app, version, or locale directory
* `fs:delete-to-trash` — Move a file or directory to OS trash (`shell.trashItem`)
* `fs:copy-image` — Copy an external image into the workspace (`fs.copyFileSync`)
* `fs:rename-files` — Batch-rename screenshot files for reordering
* `fs:list-images` — List images in a screenshot directory

**Google Play API (Renderer → Main):**
* `api:publish` — Execute the full publish transaction flow
* `api:import-live` — Execute the import live data flow
* `api:fetch-locales` — Fetch supported BCP-47 locale list from the API

**Settings (Renderer → Main):**
* `settings:get` — Read current application settings
* `settings:set` — Update application settings (workspace path, service account key path)

**File Watcher Events (Main → Renderer):**
* `watcher:file-changed` — A file in the workspace was modified externally
* `watcher:file-added` — A new file was added to the workspace
* `watcher:file-deleted` — A file was removed from the workspace

**Progress & Errors (Main → Renderer):**
* `progress:update` — Publish/import step progress update
* `progress:error` — Error during an operation
* `progress:complete` — Operation finished successfully

## 4. File System Architecture

The application reads and writes exclusively to a designated `Workspace` directory.
```
/PlayStoreWorkspace
└── /com.mycompany.app_one                           <- App Root (Named by Package ID)
    ├── app_config.json                              <- App identifying info
    ├── app_details.json                             <- Global app metadata
    ├── local_ui_icon.png                            <- Internal UI thumbnail (Not uploaded)
    ├── /v1.0_Launch                                 <- Historical Version Directory
    │   ├── version_metadata.json                    <- Version tracking & notes
    │   └── /en-US                                   <- Locale Directory (Strict BCP-47 tag)
    │       ├── title.txt
    │       ├── short_description.txt
    │       ├── full_description.txt
    │       ├── video_url.txt
    │       ├── high_res_icon.png                    <- Store Icon (Uploaded)
    │       ├── feature_graphic.png                  <- Feature Graphic (Uploaded)
    │       └── /screenshots
    │           ├── /phone                           <- Variant Sub-directories
    │           │   ├── 01_login.png                 <- Ordered via numeric prefix
    │           │   └── 02_home.png
    │           ├── /tablet_7
    │           ├── /tablet_10
    │           ├── /tv
    │           └── /wear
    └── /v1.1_Holiday                                <- Current/Live Version Directory
```

## 5. Data Models (JSON Schemas)

### 5.1 `app_config.json`

Located at the App Root. Used to populate the home grid and identify the target application.
```
{
  "appName": "My Awesome App",
  "packageName": "com.mycompany.app_one",
  "liveVersionDir": "v1.1_Holiday" 
}
```

_Note: `liveVersionDir` is updated only via two actions: a successful **Publish** to Google Play, or an **Import Live Data** operation. There is no manual "Set as Latest" override._

### 5.2 `app_details.json`

Located at the App Root. Contains global Google Play settings applied via the `AppDetails` API.
```
{
  "defaultLanguage": "en-US",
  "contactEmail": "support@mycompany.com",
  "contactWebsite": "[https://mycompany.com](https://mycompany.com)",
  "contactPhone": "+18005550199",
  "privacyPolicyUrl": "[https://mycompany.com/privacy](https://mycompany.com/privacy)" 
}
```

_Note: `privacyPolicyUrl` is stored locally for reference only and cannot be published via the API._

### 5.3 `version_metadata.json`

Located inside each Version Directory. Controls chronological sorting, tracks publish state, and stores unstructured notes.
```
{
  "createdAt": "2026-04-05T12:00:00Z",
  "status": "draft",
  "customNotes": "Internal notes, to-do lists, or external links go here."
}
```

**Valid `status` values:**
* `draft` — Default on creation or duplication. Indicates the listing has not been published.
* `published` — Set automatically after a successful publish to Google Play.
* `archived` — Set manually by the user. Hides the version from the main Dashboard view (accessible via a "Show Archived" toggle).

## 6. UI/UX Architecture & Data Flow

### Settings Page

* **Access:** Available via a gear icon in the application header, accessible from any screen.
* **Workspace Path (Required):** A directory picker for the workspace root. The Home Grid is inaccessible until a valid workspace path is set.
* **Service Account Key Path (Optional):** A file picker for the Google Cloud Service Account JSON key. Required only for Publish and Import operations. If not set, API-dependent buttons are disabled with a tooltip explaining why.
* **Storage:** Settings are persisted as a JSON file in Electron's `app.getPath('userData')` directory (OS-specific user data location).

### Screen 1: Home (App Grid)

* **Action:** App launches. If workspace path is not configured, the user is directed to the Settings page.
* **Backend:** Main process reads the workspace directory. Iterates through app folders.
* **Data Sources:** Reads `app_config.json` (Name) and `local_ui_icon.png` (Thumbnail).
* **UI Constraint:** Fast loading. Does not deeply scan version folders yet.
* **Action (Add App):** An "Add App" button prompts for a package name and display name. The backend creates a new app root directory named by the package ID, containing a populated `app_config.json`, an empty `app_details.json`, and a placeholder `local_ui_icon.png`.
* **Action (Import from Play Console):** An "Import from Play Console" button prompts for a package name. Requires an authenticated service account. The backend fetches the live app data from Google Play and creates the full local structure (reuses the Import Live flow from Section 9.3, targeting a new app root directory).

### Screen 2: App Dashboard

* **Action:** User clicks an app in the grid.
* **Layout:**
  * **Global Settings:** Inputs bound to `app_details.json`.
  * **Latest Listing:** Matches folder named in `app_config.json -> liveVersionDir`.
  * **Historical Listings:** All other version folders, parsed and sorted descending by `createdAt` in `version_metadata.json`.
* **Action (New Listing):** Clicking "Create New" executes `fs.cpSync()` to duplicate the liveVersionDir folder as a starting point. It requires the user to input a new name, generates a new `createdAt` timestamp, and renames the new folder.
* **Action (Duplicate Listing):** Each listing (both Latest and Historical) features a "Duplicate" button. Clicking this triggers a prompt with a required field for a new listing name. Once provided, it executes fs.cpSync() to duplicate that specific folder's entire contents into a new directory, generating a new `createdAt` timestamp. This creates a fully pre-populated starting point based on the selected version.
* **Action (Import as New Latest):** Clicking "Import Live Data" from the Dashboard prompts the backend to fetch the exact current live state of the app directly from Google Play. It generates a new timestamped version directory (e.g., `/Imported_YYYYMMDD`), updates the app_details.json with the live global metadata, builds out all active BCP-47 locale directories, saves all fetched text assets into corresponding `.txt` files, and downloads all live images/screenshots into their respective sub-directories. Finally, it updates `app_config.json -> liveVersionDir` to automatically set this newly imported folder as the "Latest Listing".
* **Action (Delete Listing):** Each listing features a "Delete" button. Clicking this triggers a confirmation dialog. Upon confirmation, the version directory is moved to the OS trash via `electron.shell.trashItem()`. If the deleted listing was the `liveVersionDir`, the user is prompted to select a new latest listing.
* **Action (Archive Listing):** Each listing features an "Archive" button that sets `status` to `archived` in the version's `version_metadata.json`. Archived listings are hidden by default but visible via a "Show Archived" toggle on the Dashboard.
* **Action (Delete App):** The Dashboard header includes a "Delete App" action (e.g., in a menu or danger zone). Clicking this triggers a confirmation dialog warning that the entire app directory will be removed. Upon confirmation, the app folder is moved to the OS trash.

### Screen 3: Store Listing Editor

* **Action:** User opens a specific version folder.
* **Layout:** Tabbed (and scrollable horizontally if there are too many to fit the current width of the UI) or side-by-side Locale views. Tabs display human-readable locale names with BCP-47 tags as subtitles (e.g., "English (US)" with `en-US` below).
* **Action (Import Overwrite):** Includes an "Import Live Data" button within the editor. Clicking this triggers a warning prompt. Upon confirmation, it fetches the live state from Google Play and overwrites the contents of the currently open version directory. Existing `.txt` files are replaced, existing images are deleted and replaced with downloaded live images, and active locales are synced without creating a new version folder.
* **Action (Add Localization):** Includes an "Add Localization" button that opens a searchable dropdown menu. The dropdown list is fetched from the Google Play API when authenticated (falls back to a hardcoded list when offline). The user can type the language name to filter options. Display format: "Spanish (Latin America) — es-419". Selecting a language creates a new BCP-47 locale sub-directory populated with the necessary empty `.txt` files and image folders.
* **Action (Duplicate Localization):** Includes a "Duplicate" button within each localization tab. Clicking this opens a searchable dropdown (similar to "Add Localization") to select a target language. Selecting the target language executes `fs.cpSync()` to copy the current locale's directory (including all text files and images) into a new BCP-47 locale sub-directory, providing a complete starting point for the new localization.
* **Action (Delete Localization):** Each locale tab includes a "Delete" option. Clicking this triggers a confirmation dialog. Upon confirmation, the locale sub-directory is moved to OS trash.
* **Text Editing:** Textareas mapped directly to `title.txt`, `short_description.txt`, `full_description.txt`, etc. Each textarea displays a live character count against its maximum.
* **Video URL:** A text input field mapped to `video_url.txt`. Validated as a properly formatted URL.
* **Image Management:** 
  * Images are displayed in a responsive grid layout that automatically adapts to the available width of the UI.
  * Drag-and-drop zones mapped to `/screenshots/phone`, etc.
  * Dropping an image triggers absolute path extraction, validation, and `fs.copyFileSync()` into the workspace.
  * Reordering in the UI physically renames the files in the directory (e.g., `01_...`, `02_...`).
  * Individual images can be deleted via a delete button on each image thumbnail (confirmation dialog, then moved to OS trash).

## 7. Pre-Flight Validation Engine

The "Publish" button is disabled until the localized payload passes these strict checks:

### 7.1 Text Validation

* `title.txt`: Max 30 characters.
* `short_description.txt`: Max 80 characters.
* `full_description.txt`: Max 4,000 characters.
* Locale Directory Names: Must exactly match Google Play BCP-47 tags (e.g., `es-419`, `en-GB`).

### 7.2 Image Validation

* `high_res_icon.png`: Exactly 512x512 px. Max 1MB. (PNG/JPEG)
* `feature_graphic.png`: Exactly 1024x500 px. Max 1MB. (PNG/JPEG)
* `screenshots/*`: Min length 320px, Max length 3840px. Max aspect ratio 2:1. (PNG/JPEG)
* Screenshot count per type per locale: Minimum 2, maximum 8. Enforced on publish.

### 7.3 Video Validation

* `video_url.txt`: Must be a valid URL if the file is present and non-empty. This is an optional field — an empty or absent `video_url.txt` passes validation.

## 8. Error Handling & Progress Strategy

### 8.1 Inline Progress Indicator

Long-running operations (Publish, Import) display an inline progress section in the UI (not a blocking modal). Each step shows:
* The current locale being processed (e.g., "en-US")
* The asset type (e.g., "Uploading phone screenshots...")
* Per-step success/failure status (checkmark or error icon)

### 8.2 Error Panel

* Errors are collected in a **collapsible error panel** at the bottom of the screen.
* Each error entry includes: the failed operation, the affected file/locale, and the full error message from the API or file system.
* **Partial failure handling:** If a publish operation fails mid-way (e.g., after uploading some locales), the API edit is **NOT committed**. The user sees exactly which steps failed. They can fix the issues and retry the entire publish.
* **Network errors:** Detected and surfaced with a "Retry" button.
* **File I/O errors:** Surfaced immediately with the affected file path and a suggestion (e.g., "Check file permissions").

### 8.3 Concurrent Operation Guards

* Publish and Import buttons are **disabled** while an operation is already in progress.
* Navigating away from the Editor during an active operation triggers a confirmation dialog warning that the operation is still running.

## 9. Google Play API Integration Strategy

### 9.1 Authentication

The application requires a **Google Cloud Service Account JSON Key** with "Editor" access to the Google Play Console. The path to this key is configured in the application's Settings page (see Section 6).

### 9.2 The Publish Transaction Flow (Write)

When pushing a release, the Node backend executes the following sequential steps using the Google APIs Client Library (googleapis). Each step emits progress updates to the Renderer via `progress:update`.

1. **Initialize Edit:** `play.edits.insert({ packageName })` -> Returns `editId`.
1. **Push Global Details:** `play.edits.details.update()` using data from `app_details.json`.
1. **Iterate Locales:** Loop through each locale folder (e.g., `en-US`):
    * Push texts (including `video` field from `video_url.txt`) via `play.edits.listings.update()`.
    * **Smart Image Diff:** Before uploading images for a locale, fetch the current live image list via `play.edits.images.list()`. Compare local images with live images (by hash or URL comparison). Delete only images that are no longer present locally via `play.edits.images.delete()`. Upload only images that are new or changed via `play.edits.images.upload()`. This avoids unnecessary re-uploads and prevents screenshot duplication.
    * Sort screenshots alphanumerically, then push sequentially to the respective image types (phone, sevenInch, tenInch) via `play.edits.images.upload()`.
1. **Commit:** `play.edits.commit({ editId })`.
1. **Post-Commit Hooks:**
    * Update `app_config.json -> liveVersionDir` to match the newly published folder.
    * Update `version_metadata.json -> status` to `published`.

### 9.3 The "Import Live" Transaction Flow (Read)

When importing the current live state, the backend uses the API as a read-only snapshot:

1. **Initialize Edit:** `play.edits.insert({ packageName })` -> Returns `editId` (creates a read-only snapshot).
1. **Fetch Global Details:** `play.edits.details.get()` -> Overwrites the local `app_details.json`.
1. **Fetch Active Locales:** `play.edits.listings.list()` -> Returns an array of active BCP-47 tags.
1. **Iterate & Download:** For each active locale:
    * **Texts:** `play.edits.listings.get()` -> Write results to `title.txt`, `short_description.txt`, `full_description.txt`, and `video_url.txt`.
    * **Images:** Query `play.edits.images.list()` for each image type (`icon`, `featureGraphic`, `phoneScreenshots`, etc.). Download the provided image URLs via a standard HTTP GET request using `fs.createWriteStream()` to save them into their respective local directories.
    * **Import Naming Convention:** Downloaded screenshots are named with zero-padded numeric prefixes matching the API order: `01.png`, `02.png`, etc. Icon and feature graphic use their standard names: `high_res_icon.png`, `feature_graphic.png`. Image format is preserved as-is from the source (PNG/JPEG).

    _(Note: Target directories for text and images depend on where the action was triggered. If from the Dashboard, it populates a newly created directory. If from the Editor, it overwrites the currently open directory)._
1. **Clean Up:** Do not commit the edit. Let the `editId` safely expire since no changes were pushed.

### 9.4 BCP-47 Locale List

The "Add Localization" and "Duplicate Localization" dropdowns source their locale list from the Google Play API via `play.edits.listings.list()` when authenticated. If the service account is not configured or the network is unavailable, the app falls back to a **hardcoded static list** of all ~80 locales supported by Google Play. The static list is updated periodically with new releases of the application.

Display format in the UI: human-readable name + BCP-47 tag (e.g., "Spanish (Latin America) — es-419").

### 9.5 Known API Limitations

* **Genesis Upload:** The app cannot create a completely new app package. The first APK/AAB and initial store setup must be done manually in the web console.
* **Privacy Policy:** Must be managed manually in the Play Console under "App Content".
* **Release Notes:** "What's new" texts are tied to APK track deployments (`play.edits.tracks.update`), not the main store listing, and are handled outside the scope of this visual manager.

## 10. File Watching

The application uses `chokidar` to watch the active workspace directory for external changes in real time.

* **Scope:** Watches the entire workspace root recursively.
* **Events:** File added, modified, or deleted. Changes are pushed to the Renderer via IPC (`watcher:file-changed`, `watcher:file-added`, `watcher:file-deleted`).
* **UI Reaction:** The relevant Svelte store is updated, causing the affected UI section to re-render automatically (e.g., a new screenshot appears in the grid, a modified text file updates the textarea).
* **Debouncing:** Rapid successive changes are debounced (300ms) to avoid excessive re-renders.
* **Operation Lock:** File watching events are **ignored** during active Publish or Import operations to prevent conflicts between API-driven file writes and watcher-triggered UI updates. Watching resumes after the operation completes, triggering a single full refresh.

## 11. Menu Bar & Keyboard Shortcuts

The application uses Electron's `Menu` API to provide a standard menu bar.

### 11.1 Menu Structure

* **File:** New App, Open Workspace, Settings (`Ctrl+,`), Quit (`Ctrl+Q`)
* **Edit:** Undo (`Ctrl+Z`), Redo (`Ctrl+Shift+Z`), Cut (`Ctrl+X`), Copy (`Ctrl+C`), Paste (`Ctrl+V`), Select All (`Ctrl+A`)
* **View:** Refresh (`F5`), Toggle Archived Versions, Zoom In (`Ctrl+=`), Zoom Out (`Ctrl+-`), Reset Zoom (`Ctrl+0`)
* **Actions:** Publish (`Ctrl+Shift+P`), Import Live Data (`Ctrl+Shift+I`), Add Localization (`Ctrl+L`)
* **Help:** About, Documentation Link

### 11.2 Key Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+S` | Save current text edits to disk |
| `Ctrl+N` | Create new version/listing |
| `F5` | Manual refresh from disk |
| `Ctrl+,` | Open Settings page |
| `Delete` | Delete selected item (with confirmation dialog) |
| `Ctrl+Shift+P` | Publish to Google Play |
| `Ctrl+Shift+I` | Import Live Data |
| `Ctrl+L` | Add Localization |