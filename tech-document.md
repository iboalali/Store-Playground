# Technical Specification: Store Playground

## 1. Project Overview

A local-first, Electron-based desktop application for managing Google Play Store listing assets (text, metadata, and graphics). The core philosophy is **"File-System-as-Database."** All data is stored in standard local directories, `.txt`, and `.json` files, allowing for seamless external editing, version control via Git, and easy backups.

## 2. Technology Stack

* **Application Framework:** Electron (Node.js + Chromium)
* **Backend Logic:** Node.js (`fs` module for file manipulation)
* **Frontend:** Svelte (compiled, lightweight — minimal runtime overhead for Electron)
* **Image Processing:** `sharp` or `image-size` (for dimension validation)
* **File Watching:** `chokidar` (for real-time detection of external file changes)
* **Google API:** `googleapis` (Google Play Android Developer API `v3` for store listings, Google Cloud Storage JSON API `v1` for finance report downloads)
* **ZIP Extraction:** `adm-zip` (for extracting compressed earnings report archives from GCS)
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
* `fs:rename-directory` — Rename a directory (`fs.renameSync`)
* `fs:move-file` — Move a file between locations (`fs.renameSync`, same filesystem)
* `fs:read-json-file` — Read and parse any JSON file in the workspace

**Screenshot Management (Renderer → Main):**
* `screenshots:list-screens` — Composite read: returns all screens with their variants and image paths for a given screenshot version directory

**Financial Reports (Renderer → Main):**
* `reports:import-csv` — Parse an earnings CSV file, group by month, write parsed JSON, update index
* `reports:get-index` — Read `reports_index.json` (list of imported months, date range, apps)
* `reports:get-month` — Read parsed transactions for a given month key
* `reports:get-aggregation` — Compute monthly/country/product aggregations with optional app filter
* `reports:delete-month` — Remove a month's data (parsed JSON + raw CSV) and update index
* `reports:list-remote` — List available earnings reports in the configured GCS bucket
* `reports:download-remote` — Download new earnings reports from GCS and import via the existing CSV pipeline

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
├── /reports                                         <- Financial Reports (workspace-level, all apps)
│   ├── reports_index.json                           <- Index of imported CSVs + metadata
│   ├── /csv                                         <- Raw imported CSV files
│   │   └── earnings_2024_12.csv
│   └── /parsed                                      <- Pre-parsed JSON per month
│       └── 2024-12.json
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
    │       ├── high_res_icon.png                    <- Store Icon (Uploaded, API type: icon)
    │       ├── feature_graphic.png                  <- Feature Graphic (Uploaded, API type: featureGraphic)
    │       ├── tv_banner.png                        <- TV Banner (Uploaded, API type: tvBanner)
    │       └── /screenshots
    │           ├── /phone                           <- API type: phoneScreenshots
    │           │   ├── 01_login.png                 <- Ordered via numeric prefix
    │           │   └── 02_home.png
    │           ├── /tablet_7                        <- API type: sevenInchScreenshots
    │           ├── /tablet_10                       <- API type: tenInchScreenshots
    │           ├── /chromebook                      <- API type: chromebookScreenshots
    │           ├── /tv                              <- API type: tvScreenshots
    │           ├── /wear                            <- API type: wearScreenshots
    │           └── /android_xr                      <- API type: androidXrScreenshots
    ├── /v1.1_Holiday                                <- Current/Live Version Directory
    ├── /screenshots                                 <- Screenshot Management Root
    │   ├── screenshot_config.json                   <- Version order + screen order per version
    │   ├── .undo/                                   <- Single backup image for undo
    │   └── /versions
    │       └── /Initial_Set                         <- Screenshot Version Directory
    │           └── /login                           <- Screen Directory (kebab-case slug)
    │               ├── _screen.json                 <- Screen metadata + variant definitions
    │               ├── light-mode.png               <- Variant image (slug.ext)
    │               └── dark-mode.png
    └── /release_notes                               <- Release Notes Management Root
        ├── release_notes_config.json                <- Version order + per-version metadata
        └── /versions
            └── /v2.0_Holiday                        <- Release Notes Version Directory
                ├── en-US.txt                        <- Release note text per BCP-47 locale
                ├── ar.txt
                └── de-DE.txt
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

### 5.4 `screenshot_config.json`

Located at `{app_root}/screenshots/`. Manages the screenshot library's version hierarchy.
```
{
  "versionOrder": ["Holiday_Update", "Initial_Set"],
  "versions": {
    "Initial_Set": {
      "createdAt": "2026-04-01T10:00:00Z",
      "screenOrder": ["login", "home", "settings"]
    },
    "Holiday_Update": {
      "createdAt": "2026-04-05T14:00:00Z",
      "screenOrder": ["login", "home", "settings", "checkout"]
    }
  }
}
```

* `versionOrder` defines display order (first entry is "latest"). Updated when versions are added, deleted, or reordered.
* `versions[name].screenOrder` lists screen directory slugs in display order for that version.

### 5.5 `_screen.json`

Located inside each screen directory under a screenshot version. Defines the screen's display name and its variant layout.
```
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

* `variantOrder` lists variant slugs in left-to-right display order.
* `variantNames` maps slugs to human-readable display names.
* Variant images are stored as `{slug}.{png|jpg|jpeg}` in the same directory as `_screen.json`.

### 5.6 `reports_index.json`

Located at `{workspace}/reports/`. Tracks all imported financial CSV files and their metadata.
```
{
  "importedFiles": [
    {
      "filename": "earnings_2024_12.csv",
      "importedAt": "2026-04-06T10:00:00Z",
      "monthKey": "2024-12",
      "rowCount": 342,
      "apps": ["com.iboalali.hidepersistentnotifications", "com.iboalali.otherapp"]
    }
  ],
  "dateRange": { "earliest": "2024-12", "latest": "2025-03" }
}
```

* `importedFiles` tracks each CSV import with the detected month, row count, and which apps appeared in it.
* `dateRange` is derived from the full set of imported months for quick access.

### 5.7 Parsed Month Data (`/reports/parsed/{month}.json`)

Pre-parsed transaction data for fast loading. One file per month.
```
{
  "month": "2024-12",
  "transactions": [
    {
      "id": "GPA.3380-1561-1859-06563",
      "date": "2024-12-01T18:23:05-08:00",
      "type": "charge",
      "refundType": null,
      "productId": "com.iboalali.hidepersistentnotifications",
      "productTitle": "Hide Persistent Notifications",
      "productType": "one-time",
      "skuId": null,
      "hardware": "gto",
      "buyerCountry": "US",
      "buyerState": "NV",
      "buyerPostalCode": "89102",
      "buyerCurrency": "USD",
      "buyerAmount": 2.99,
      "conversionRate": 0.9489,
      "merchantCurrency": "EUR",
      "merchantAmount": 2.84,
      "basePlanId": null,
      "offerId": null,
      "serviceFeePercent": null,
      "firstMillionEligible": true
    }
  ]
}
```

* Transactions are normalized from the CSV: column names are camelCased, `Transaction Type` is mapped to a union type (`charge` | `google-fee` | `charge-refund` | `google-fee-refund` | `tax`), `Product Type` is mapped to `one-time` (0) or `subscription` (1), dates are parsed to ISO 8601.
* Charge and Google fee rows share the same `id` (the transaction ID from the `Description` column). They are stored as separate rows to preserve the original data, and paired during aggregation.

### 5.8 CSV Source Format (Google Play Earnings Report)

The CSV is exported manually from Google Play Console → "Download reports" → "Earnings". It is **not app-specific** — a single CSV contains transactions across all apps in the developer account. The app filters by `Product id` (package name) for per-app views.

Key columns and their types:

| CSV Column | Parsed Field | Notes |
|---|---|---|
| Description | `id` | Transaction ID (e.g., GPA.3380-...) |
| Transaction Date | `date` | Parsed from "Dec 1, 2024" format |
| Transaction Time | `date` | Combined with date, timezone preserved |
| Transaction Type | `type` | `Charge` → `charge`, `Google fee` → `google-fee`, `Charge refund` → `charge-refund`, `Google fee refund` → `google-fee-refund`, `Tax` → `tax` |
| Refund Type | `refundType` | Empty string → null |
| Product Title | `productTitle` | App display name |
| Product id | `productId` | Package name |
| Product Type | `productType` | `0` → `one-time`, `1` → `subscription` |
| Sku Id | `skuId` | In-app product/subscription SKU, empty → null |
| Hardware | `hardware` | Device model code |
| Buyer Country | `buyerCountry` | 2-letter code (US, DE, etc.) |
| Buyer State | `buyerState` | State/province |
| Buyer Postal Code | `buyerPostalCode` | Postal code |
| Buyer Currency | `buyerCurrency` | Currency code (USD, EUR, etc.) |
| Amount (Buyer Currency) | `buyerAmount` | Parsed as number |
| Currency Conversion Rate | `conversionRate` | Parsed as number |
| Merchant Currency | `merchantCurrency` | Your payout currency |
| Amount (Merchant Currency) | `merchantAmount` | Parsed as number |
| Base Plan ID | `basePlanId` | Subscription base plan, empty → null |
| Offer ID | `offerId` | Subscription offer, empty → null |
| First USD 1M Eligible | `firstMillionEligible` | `Yes` → true, `No` → false |
| Service Fee % | `serviceFeePercent` | Parsed as number, empty → null |

### 5.9 `release_notes_config.json`

Located at `{app_root}/release_notes/`. Manages the release notes version hierarchy. Release note versions are **independent** of store listing versions — they have their own naming and lifecycle.
```
{
  "versionOrder": ["v2.0_Holiday", "v1.0_Launch"],
  "versions": {
    "v1.0_Launch": { "createdAt": "2026-04-01T10:00:00Z" },
    "v2.0_Holiday": { "createdAt": "2026-04-05T14:00:00Z" }
  }
}
```

* `versionOrder` defines display order (first entry is "latest"/newest). Updated when versions are added, deleted, or reordered.
* Each version directory contains one `.txt` file per BCP-47 locale (e.g., `en-US.txt`, `ar.txt`). Each file contains the release note text for that language and version.
* Release notes are limited to **500 characters per language** (Google Play Console limit).

### 5.10 Release Note Text Files (`/release_notes/versions/{version}/{locale}.txt`)

Plain UTF-8 text files containing the release note content for a single language in a single version. One file per locale per version. Directly readable and editable outside the app.

The "Generate Output" feature combines text from multiple versions (newest → oldest) per locale, separated by `\n\n`, until the 500-character limit is reached. The output is formatted in the Play Console's tag format:
```
<en-US>
What's new in v2.0: Holiday theme and performance improvements.

v1.0: Initial release with core features.
</en-US>
<ar>
الجديد في الإصدار 2.0: سمة العطلة وتحسينات الأداء.
</ar>
```

## 6. UI/UX Architecture & Data Flow

### Settings Page

* **Access:** Available via a settings (cog) icon in the application header, accessible from any screen.
* **Workspace Path (Required):** A directory picker for the workspace root. The Home Grid is inaccessible until a valid workspace path is set.
* **Service Account Key Path (Optional):** A file picker for the Google Cloud Service Account JSON key. Required only for Publish, Import, and Finance Download operations. If not set, API-dependent buttons are disabled with a tooltip explaining why.
* **Play Console Bucket (Optional):** A text input for the GCS bucket name where Play Console deposits earnings reports (e.g. `pubsite_prod_rev_01234567890`). Found in Play Console under Download reports > Financial > Cloud Storage URI. Required for automatic finance report downloads.
* **Storage:** Settings are persisted as a JSON file in Electron's `app.getPath('userData')` directory (OS-specific user data location). Schema: `{ workspacePath: string | null, serviceAccountKeyPath: string | null, playConsoleBucketId: string | null }`.
* **Reset Everything:** A "Danger Zone" section at the bottom of the Settings page provides a "Reset Everything" button. Clicking it opens a confirmation dialog (danger-styled) warning the user that all workspace contents will be moved to the OS trash and settings will be cleared. On confirmation, the backend trashes all top-level entries inside the workspace directory via `shell.trashItem()`, stops the file watcher, and resets the settings file to defaults (`workspacePath: null`, `serviceAccountKeyPath: null`). The app then returns to the initial unconfigured Settings screen. This is useful for testing and starting fresh. The IPC channel used is `settings:reset-all` (no arguments, returns void).

### Screen 1: Home (App Grid)

* **Action:** App launches. If workspace path is not configured, the user is directed to the Settings page.
* **Backend:** Main process reads the workspace directory. Iterates through app folders.
* **Data Sources:** Reads `app_config.json` (Name) and `local_ui_icon.png` (Thumbnail).
* **UI Constraint:** Fast loading. Does not deeply scan version folders yet.
* **Action (Add App):** An "Add App" button prompts for a package name and display name, with an optional file picker for a custom app icon. The backend creates a new app root directory named by the package ID, containing a populated `app_config.json`, an empty `app_details.json`, and the provided icon saved as `local_ui_icon.png`. If no icon is provided, a bundled generic app icon is used instead.
* **Action (Import from Play Console):** An "Import from Play Console" button prompts for a package name. If a service account key is not configured, clicking the button shows an error banner instead of opening the import dialog. Requires an authenticated service account. The backend fetches the live app data from Google Play and creates the full local structure (reuses the Import Live flow from Section 9.3, targeting a new app root directory).

### Screen 2: App Dashboard

* **Action:** User clicks an app in the grid.
* **Layout:**
  * **Global Settings:** Inputs bound to `app_details.json`.
  * **Latest Listing:** Matches folder named in `app_config.json -> liveVersionDir`.
  * **Historical Listings:** All other version folders, parsed and sorted descending by `createdAt` in `version_metadata.json`.
* **Action (New Listing):** Clicking "Create New" executes `fs.cpSync()` to duplicate the liveVersionDir folder as a starting point. It requires the user to input a new name, generates a new `createdAt` timestamp, and renames the new folder.
* **Action (Duplicate Listing):** Each listing (both Latest and Historical) features a "Duplicate" button. Clicking this triggers a prompt with a required field for a new listing name. Once provided, it executes fs.cpSync() to duplicate that specific folder's entire contents into a new directory, generating a new `createdAt` timestamp. This creates a fully pre-populated starting point based on the selected version.
* **Action (Import as New Latest):** Clicking "Import Live Data" from the Dashboard prompts the backend to fetch the exact current live state of the app directly from Google Play. It generates a new timestamped version directory (e.g., `/Imported_YYYYMMDD`), updates the app_details.json with the live global metadata, builds out all active BCP-47 locale directories, saves all fetched text assets into corresponding `.txt` files, and downloads all live images/screenshots into their respective sub-directories. Finally, it updates `app_config.json -> liveVersionDir` to automatically set this newly imported folder as the "Latest Listing".
* **Action (Rename Listing):** Each listing features a "Rename" option. Clicking this opens an inline editable field pre-filled with the current folder name. Upon confirmation, the backend renames the version directory via `fs.renameSync()`. If the renamed listing is the `liveVersionDir`, `app_config.json -> liveVersionDir` is updated to reflect the new name.
* **Action (Delete Listing):** Each listing features a "Delete" button. Clicking this triggers a confirmation dialog. Upon confirmation, the version directory is moved to the OS trash via `electron.shell.trashItem()`. If the deleted listing was the `liveVersionDir`, the user is prompted to select a new latest listing.
* **Action (Archive Listing):** Each listing features an "Archive" button that sets `status` to `archived` in the version's `version_metadata.json`. Archived listings are hidden by default but visible via a "Show Archived" toggle on the Dashboard.
* **Action (Delete App):** The Dashboard header includes a "Delete App" action (e.g., in a menu or danger zone). Clicking this triggers a confirmation dialog warning that the entire app directory will be removed. Upon confirmation, the app folder is moved to the OS trash.

### Screen 3: Store Listing Editor

* **Action:** User opens a specific version folder.
* **Layout:** Tabbed (and scrollable horizontally if there are too many to fit the current width of the UI) or side-by-side Locale views. Tabs display human-readable locale names with BCP-47 tags as subtitles (e.g., "English (US)" with `en-US` below).
* **Action (Import Overwrite):** Includes an "Import Live Data" button within the editor. Clicking this triggers a warning prompt. Upon confirmation, it fetches the live state from Google Play and overwrites the contents of the currently open version directory. Existing `.txt` files are replaced, existing images are deleted and replaced with downloaded live images, and active locales are synced without creating a new version folder.
* **Action (Add Localization):** Includes an "Add Localization" button that opens a searchable dropdown menu populated from a hardcoded list of all 77 Google Play supported locales (see Section 9.4). The user can type the language name to filter options. Display format: "Spanish (Latin America) — es-419". Selecting a language creates a new BCP-47 locale sub-directory populated with the necessary empty `.txt` files and image folders.
* **Action (Duplicate Localization):** Includes a "Duplicate" button within each localization tab. Clicking this opens a searchable dropdown (similar to "Add Localization") to select a target language. Selecting the target language executes `fs.cpSync()` to copy the current locale's directory (including all text files and images) into a new BCP-47 locale sub-directory, providing a complete starting point for the new localization.
* **Action (Delete Localization):** Each locale tab includes a "Delete" option. Clicking this triggers a confirmation dialog. Upon confirmation, the locale sub-directory is moved to OS trash.
* **Text Editing:** Textareas mapped directly to `title.txt`, `short_description.txt`, `full_description.txt`, etc. Each textarea displays a live character count against its maximum.
* **Video URL:** A text input field mapped to `video_url.txt`. Validated as a properly formatted URL.
* **Image Management:** 
  * Images are displayed in a responsive grid layout that automatically adapts to the available width of the UI.
  * Each image slot supports two methods for adding images: a **file picker** button or **drag-and-drop**. Both are mapped to the relevant directory (`/screenshots/phone`, etc.).
  * Adding an image (via either method) triggers validation, then `fs.copyFileSync()` into the workspace.
  * Reordering in the UI physically renames the files in the directory (e.g., `01_...`, `02_...`).
  * Individual images can be deleted via a delete button on each image thumbnail (confirmation dialog, then moved to OS trash).
* **Pick from Screenshot Library:**
  * A "Pick from Library" button is available in each screenshot section (phone, tablet, etc.), alongside the existing file picker.
  * Clicking it opens the `ScreenshotPicker` modal, which displays the app's screenshot library organized by version > screen > variant.
  * The latest screenshot version is shown by default, with a dropdown to select older versions.
  * Screens are displayed as collapsible sections; variants are shown as a thumbnail grid.
  * Clicking a thumbnail closes the modal and **appends** the selected image to the end of the screenshot list as the next numbered file (e.g., `03_picked.png`) via `fs:copy-image`.

### Screen 4: Screenshot Manager

* **Access:** A "Screenshot Manager" button on the App Dashboard navigates to this page. Breadcrumb: Home > App Name > Screenshot Manager.
* **Purpose:** A dedicated screenshot library for managing app screenshots organized by screens and variants, independent of the per-locale/per-device structure used in the Store Listing Editor.

#### Screenshot Versions

Screenshot versions are **not tied to APK versions or listing versions** — they have independent naming and lifecycle.

* **Layout:** A version selector dropdown at the top of the page shows all screenshot versions. The first entry in `versionOrder` is the "latest" and is shown by default.
* **Action (New Version):** Copies the latest version (entire directory tree) as a starting point. Prompts for a name. Inserts at the front of `versionOrder`.
* **Action (Duplicate This Version):** Available on any version (including older ones). Copies the currently viewed version as a starting point for a new version. Prompts for a name.
* **Action (Rename Version):** Renames the version directory via `fs:rename-directory`. Updates `versionOrder` and `versions` key in `screenshot_config.json`.
* **Action (Delete Version):** Moves the version directory to OS trash. Removes from `screenshot_config.json`. Confirmation dialog required.

#### Screens

Screens represent app screens (e.g., "Login", "Home", "Settings"). They are displayed as a **vertical list**.

* **Action (Add Screen):** Prompts for a display name. Creates a new directory (kebab-case slug) with an empty `_screen.json`. Appends slug to `screenOrder`.
* **Action (Delete Screen):** Moves screen directory to OS trash. Removes from `screenOrder`. Confirmation dialog required.
* **Action (Rename Screen):** Inline edit of display name. Updates `_screen.json -> displayName`. The directory slug remains unchanged.
* **Action (Reorder Screens):** Drag handles on each screen row. Dragging reorders the `screenOrder` array in `screenshot_config.json` (metadata only — no files moved).

#### Variants

Variants represent variations of a screen (e.g., "Dark Mode", "Light Mode", "Spanish"). They are displayed as a **horizontal grid** under each screen.

* **Layout:** Each variant is a slot showing either an image thumbnail or an empty placeholder, with the variant name label below.
* **Action (Add Variant):** Opens a dialog with three input modes:
  1. **From app languages (shown first):** Reads locale directories from the app's `liveVersionDir` and lists them with human-readable names from `locale-names.ts`.
  2. **All 77 locales:** The full hardcoded Google Play locale list, displayed below the app-specific languages.
  3. **Custom name:** Free text input for non-language variants (e.g., "Dark Mode", "Landscape").
* **Action (Delete Variant):** Removes the variant image file (if present) and its entry from `_screen.json`. Confirmation dialog required.
* **Action (Rename Variant):** Inline edit. Updates `variantNames` in `_screen.json`. If an image exists, renames the file to match the new slug.
* **Action (Reorder Variants):** Drag handles on variant labels. Dragging reorders the `variantOrder` array in `_screen.json` (metadata only).

#### Screenshot Management (Images)

Each variant holds exactly one screenshot (or is empty).

* **Adding a screenshot:** Two methods per variant slot:
  1. **File picker button** — standard file dialog.
  2. **Drag-and-drop from external** — drop an image file onto the slot.
  * If the variant already has an image, the old image is **replaced** (the old file is backed up to `screenshots/.undo/` for undo).
* **Moving screenshots between variants/screens:** Screenshots (not variants) can be dragged from one `VariantSlot` to another — within the same screen or across different screens.
  * If the target slot is empty, the image moves there.
  * If the target slot has an image, the two images are **swapped**.
  * Implemented via `fs:move-file` (using a temp file for swaps).
* **Undo:** A floating undo button appears when a reversible action is available. Only the **latest** change can be undone. Covers: image replacement, image move/swap, image deletion. Does NOT cover structural changes (screen/variant/version add/delete/rename). The backup is stored in `screenshots/.undo/` (at most one file, cleared on each new action).

#### Empty State

When an app has no `screenshots/` directory yet, the page shows a welcome message with a "Create First Screenshot Version" button. This creates the `screenshots/` directory, `screenshot_config.json`, and a first empty version.

### Screen 5: Financial Reports

* **Access:** Two entry points:
  1. **Per-app:** A "Financial Reports" button on the App Dashboard. Breadcrumb: Home > App Name > Financial Reports. Opens filtered to the current app's package name with "This App" view mode pre-selected.
  2. **Global:** A bar chart icon button in the application header (next to the settings cog), accessible from any screen. Breadcrumb: Home > Financial Reports. Opens in "All Apps" view mode with the "This App / All Apps" toggle hidden.
* **Purpose:** A revenue analytics dashboard driven by Google Play Console earnings CSV files. Reports can be downloaded directly from the Play Console's GCS bucket or imported manually. Since the Google Play Developer API does not expose financial data, earnings reports are accessed via the Google Cloud Storage JSON API.
* **Data location:** Reports are stored at the **workspace level** (`{workspace}/reports/`), not per-app, because a single CSV contains all apps. The per-app view filters by `Product id` (package name).

#### GCS Download (Automatic)

* **Action (Download from Play Console):** A "Download from Play Console" button at the top of the Import section. Requires both `serviceAccountKeyPath` and `playConsoleBucketId` to be configured in Settings.
* **Download flow:** The backend uses the Google Cloud Storage JSON API to list objects in the `earnings/` prefix of the configured GCS bucket. It compares available months against the local `reports_index.json` to identify new reports. New reports are downloaded to a temp directory, extracted from ZIP if needed (using `adm-zip`), and fed through the existing `importCsv()` pipeline. A summary is returned: `{ imported, skipped, errors }`.
* **Incremental:** Already-imported months are automatically skipped. Running download multiple times is safe and idempotent.
* **Prerequisites:** The service account needs the `Storage Object Viewer` IAM role on the GCS bucket. The bucket name must be configured in Settings.

#### CSV Import (Manual)

* **Action (Import CSV):** A collapsible "Import" section provides a drop zone and file picker for CSV files below the automatic download button. Multiple CSVs can be imported at once. This serves as a fallback when GCS access is not configured.
* **Import flow:** The backend parses the CSV, auto-detects the month from the transaction dates, normalizes column names and types, writes a parsed JSON file to `/reports/parsed/{month}.json`, copies the raw CSV to `/reports/csv/`, and updates `reports_index.json`. If a month is re-imported, the old parsed data is replaced.
* **Import summary:** After import, the UI shows: rows parsed, month detected, apps found, and any parse errors.

#### Dashboard Layout

* **Top bar:** CsvImporter (collapsible) + MonthSelector (month/year range picker, defaults to latest 6 months)
* **App filter:** When accessed from an app dashboard, defaults to the current app's package name with a toggle to switch between "This App" and "All Apps". When accessed globally from the header, defaults to "All Apps" with the toggle hidden.
* **Summary cards row:** `RevenueSummary` — four cards showing:
  * **Gross Revenue** — sum of charge amounts in merchant currency
  * **Google Fees** — sum of fee amounts (with percentage of gross)
  * **Refunds** — sum of refund amounts (with refund rate %)
  * **Net Revenue** — gross + fees + refunds (fees and refunds are negative)
  * Each card shows delta vs the previous period (arrow + percentage change)
* **Chart section:** `RevenueChart` — line/bar chart showing month-over-month trends. Gross revenue and net revenue as lines; optionally fees and refunds as stacked bars. Hover shows exact values.
* **Two-column breakdown:**
  * **Left — Country Breakdown:** Ranked table of buyer countries by revenue (country code, transaction count, gross revenue, % of total). Top 10 by default with "Show all" toggle.
  * **Right — Product Breakdown:** Table grouped by product: product title, type (one-time/subscription), SKU, revenue, transaction count. Useful for apps with in-app purchases or subscriptions.
* **Full-width transaction table:** Paginated, sortable table of individual transactions. Columns: date, type, amount (buyer currency), amount (merchant currency), country, device. Filterable by type (charges, refunds, fees, all).

#### Aggregation Engine

Aggregations are computed in the main process via the `reports:get-aggregation` IPC channel:
* **Monthly:** gross revenue, fees, refunds, net revenue, transaction count, refund rate, per month
* **By country:** revenue and transaction count per buyer country
* **By product:** revenue and transaction count per Product id / SKU

All aggregations support an optional `appPackageName` filter to scope to a single app.

#### Future Extensibility

The data model and aggregation engine are designed to support additional analytics in the future:
* **ARPU** (average revenue per user) — if install count data is manually entered or imported
* **MRR** (monthly recurring revenue) — derived from subscription charges
* **Subscription cohort retention** — tracking renewal rates over time per signup month
* **Custom date grouping** — weekly or quarterly views

These can be added as new aggregation functions and UI components without changing the storage format.

### Screen 6: Release Notes Manager

* **Access:** A "Release Notes" button on the App Dashboard, alongside "Screenshot Manager" and "Financial Reports". Breadcrumb: Home > App Name > Release Notes Manager.
* **Purpose:** A dedicated release notes management page for creating and organizing release notes per version with multi-language support. Release notes are for local use only — not uploaded to Google Play via the API.
* **Data location:** Release notes are stored per-app at `{app_root}/release_notes/`. Versions are independent of store listing versions.

#### Release Note Versions

Release note versions are **not tied to listing versions or APK versions** — they have independent naming and lifecycle.

* **Layout:** A version selector tab bar at the top of the page shows all release note versions. The first entry in `versionOrder` is the "latest" and is shown by default.
* **Action (New Version):** Creates an empty version directory. Prompts for a name. Inserts at the front of `versionOrder`.
* **Action (Duplicate Version):** Deep-copies the currently active version's directory (all locale `.txt` files) to a new version. Prompts for a name.
* **Action (Rename Version):** Renames the version directory. Updates `versionOrder` and `versions` key in `release_notes_config.json`.
* **Action (Delete Version):** Moves the version directory to OS trash. Removes from `release_notes_config.json`. Confirmation dialog required.

#### Languages

Each version contains release note text files per BCP-47 locale. Languages are displayed as a **vertical list**, each with a textarea.

* **Layout:** Each language entry shows the locale display name + BCP-47 tag, a textarea for the release note text, a character count (500-char Play Console limit), and duplicate/delete buttons.
* **Action (Add Language):** Opens the existing `LocaleSelector` component. User picks a BCP-47 locale. Creates an empty `{locale}.txt` file. Already-added locales are excluded from the selector.
* **Action (Duplicate Language):** Opens `LocaleSelector` for target locale selection. Copies the source locale's text to the new file. Useful for creating a translation starting point.
* **Action (Delete Language):** Confirmation dialog. Deletes the locale's `.txt` file.
* **Text Editing:** Textarea with live character count. Auto-saves on blur or after 500ms debounce via `fs:write-text-file`. Character count color: gray default, yellow at 90% (450+), red when over 500.

#### Generate Output

The "Generate Output" button produces combined release notes in the Play Console's tag format.

* **Algorithm:** For each locale (sorted alphabetically):
  1. Iterate through `versionOrder` (newest → oldest)
  2. Read the locale's `.txt` file from each version
  3. Append text (separated by `\n\n` between versions)
  4. Stop when the next version's text would exceed 500 characters
* **Output format:**
  ```
  <en-US>
  What's new in v2.0: Holiday theme and performance improvements.

  v1.0: Initial release with core features.
  </en-US>
  <ar>
  الجديد في الإصدار 2.0: سمة العطلة وتحسينات الأداء.
  </ar>
  ```
* **Preflight checks:** The generate dialog shows warnings for:
  - Missing locales in older versions (skipped with warning)
  - Versions where text was truncated due to the 500-char limit
* **Copy to clipboard:** A "Copy to Clipboard" button copies the formatted output for pasting into the Play Console.

#### Empty State

When an app has no `release_notes/` directory yet, the page shows a welcome message with a "Create First Version" button.

## 7. Pre-Flight Validation Engine

The "Publish" button is disabled until the localized payload passes these strict checks:

### 7.1 Text Validation

* `title.txt`: Max 30 characters.
* `short_description.txt`: Max 80 characters.
* `full_description.txt`: Max 4,000 characters.
* Locale Directory Names: Must exactly match Google Play BCP-47 tags (e.g., `es-419`, `en-GB`).

### 7.2 Image Validation

* `high_res_icon.png`: Exactly 512x512 px. Max 1MB. 32-bit PNG with alpha only.
* `feature_graphic.png`: Exactly 1024x500 px. Max 1MB. (JPEG or 24-bit PNG, no alpha)
* `tv_banner.png`: Exactly 1280x720 px. Max 1MB. (JPEG or 24-bit PNG, no alpha)
* `screenshots/*`: Min length 320px, Max length 3840px. Max aspect ratio 2:1. Max 8MB per file. (JPEG or 24-bit PNG, no alpha)
* Screenshot count per type per locale (enforced on publish):
  * `phoneScreenshots`: Min 2, max 8.
  * `sevenInchScreenshots` / `tenInchScreenshots`: Min 4, max 8 (when provided).
  * `tvScreenshots` / `wearScreenshots`: Min 1, max 8 (when provided).

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

The application requires a **Google Cloud Service Account JSON Key**. The service account must be invited as a user in the Google Play Console with at least the **"Manage store presence"** permission (`CAN_MANAGE_PUBLIC_LISTING_GLOBAL`). The path to the key file is configured in the application's Settings page (see Section 6).

**OAuth scopes:**
* `https://www.googleapis.com/auth/androidpublisher` — Used for Publish and Import Live Data operations via the Android Publisher API `v3`.
* `https://www.googleapis.com/auth/devstorage.read_only` — Used for downloading earnings reports from the Play Console's GCS bucket via the Cloud Storage JSON API `v1`. The service account additionally needs the **`Storage Object Viewer`** IAM role on the GCS bucket (`gs://pubsite_prod_rev_<DEVELOPER_ID>`).

### 9.2 The Publish Transaction Flow (Write)

When pushing a release, the Node backend executes the following sequential steps using the Google APIs Client Library (googleapis). Each step emits progress updates to the Renderer via `progress:update`.

1. **Initialize Edit:** `play.edits.insert({ packageName })` -> Returns `editId`.
1. **Push Global Details:** `play.edits.details.update()` using data from `app_details.json`.
1. **Iterate Locales:** Loop through each locale folder (e.g., `en-US`):
    * Push texts (including `video` field from `video_url.txt`) via `play.edits.listings.update()`.
    * **Smart Image Diff:** Before uploading images for a locale, fetch the current live image list via `play.edits.images.list()`. Compare local images with live images (by hash or URL comparison). Delete only images that are no longer present locally via `play.edits.images.delete()`. Upload only images that are new or changed via `play.edits.images.upload()`. This avoids unnecessary re-uploads and prevents screenshot duplication.
    * Sort screenshots alphanumerically, then push sequentially to the respective image types (`phoneScreenshots`, `sevenInchScreenshots`, `tenInchScreenshots`, `tvScreenshots`, `wearScreenshots`) via `play.edits.images.upload()`.
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

The "Add Localization" and "Duplicate Localization" dropdowns are populated from a **hardcoded static list** of all 77 locales supported by Google Play. There is no dedicated API endpoint to fetch supported locales — `play.edits.listings.list()` only returns locales that already have active listings for a given app, not the full set of available locales. The static list should be updated periodically with new releases of the application to stay in sync with Google Play.

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