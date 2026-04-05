# Technical Specification: Store Playground

## 1. Project Overview

A local-first, Electron-based desktop application for managing Google Play Store listing assets (text, metadata, and graphics). The core philosophy is **"File-System-as-Database."** All data is stored in standard local directories, `.txt`, and `.json` files, allowing for seamless external editing, version control via Git, and easy backups.

## 2. Technology Stack

* **Application Framework**: Electron (Node.js + Chromium)
* **Backend Logic:** Node.js (fs module for file manipulation)
* **Frontend:** HTML/CSS/JS (Framework agnostic, using native HTML5 Drag and Drop API preferred)
* **Image Processing:** `sharp` or `image-size` (for dimension validation)
* **Google API:** `googleapis` (specifically the Google Play Android Developer API `v3`)

## 3. File System Architecture

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

## 4. Data Models (JSON Schemas)

### 4.1 `app_config.json`

Located at the App Root. Used to populate the home grid and identify the target application.
```
{
  "appName": "My Awesome App",
  "packageName": "com.mycompany.app_one",
  "liveVersionDir": "v1.1_Holiday" 
}
```

### 4.2 `app_details.json`

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

### 4.3 `version_metadata.json`

Located inside each Version Directory. Controls chronological sorting and stores unstructured notes.
```
{
  "createdAt": "2026-04-05T12:00:00Z",
  "status": "draft",
  "customNotes": "Internal notes, to-do lists, or external links go here."
}
```

## 5. UI/UX Architecture & Data Flow

### Screen 1: Home (App Grid)

* **Action:** App launches.
* **Backend:** Node.js runs fs.readdirSync() on Workspace. Iterates through app folders.
* **Data Sources:** Reads app_config.json (Name) and local_ui_icon.png (Thumbnail).
* **UI Constraint:** Fast loading. Does not deeply scan version folders yet.

### Screen 2: App Dashboard

* **Action:** User clicks an app in the grid.
* **Layout:**
  * **Global Settings:** Inputs bound to `app_details.json`.
  * **Latest Listing:** Matches folder named in `app_config.json -> liveVersionDir`.
  * **Historical Listings:** All other version folders, parsed and sorted descending by `createdAt` in `version_metadata.json`.
* **Action (New Listing):** Clicking "Create New" executes `fs.cpSync()` to duplicate the liveVersionDir folder as a starting point. It requires the user to input a new name, generates a new `createdAt` timestamp, and renames the new folder.
* **Action (Duplicate Listing):** Each listing (both Latest and Historical) features a "Duplicate" button. Clicking this triggers a prompt with a required field for a new listing name. Once provided, it executes fs.cpSync() to duplicate that specific folder's entire contents into a new directory, generating a new `createdAt` timestamp. This creates a fully pre-populated starting point based on the selected version.
* **Action (Import as New Latest):** Clicking "Import Live Data" from the Dashboard prompts the backend to fetch the exact current live state of the app directly from Google Play. It generates a new timestamped version directory (e.g., `/Imported_YYYYMMDD`), updates the app_details.json with the live global metadata, builds out all active BCP-47 locale directories, saves all fetched text assets into corresponding `.txt` files, and downloads all live images/screenshots into their respective sub-directories. Finally, it updates `app_config.json -> liveVersionDir` to automatically set this newly imported folder as the "Latest Listing".

### Screen 3: Store Listing Editor

* **Action:** User opens a specific version folder.
* **Layout:** Tabbed (and scrollable horizontally if there are too many to fit the current width of the UI) or side-by-side Locale views (e.g., en-US, fr-FR).
* **Action (Import Overwrite):** Includes an "Import Live Data" button within the editor. Clicking this triggers a warning prompt. Upon confirmation, it fetches the live state from Google Play and overwrites the contents of the currently open version directory. Existing `.txt` files are replaced, existing images are deleted and replaced with downloaded live images, and active locales are synced without creating a new version folder.
* **Action (Add Localization):** Includes an "Add Localization" button that opens a searchable dropdown menu. The user can type the name of the language to filter the options. Selecting a language automatically creates a new BCP-47 locale sub-directory (e.g., `/es-419`) in the file system, populated with the necessary empty `.txt` files and image folders.
* **Action (Duplicate Localization):** Includes a "Duplicate" button within each localization tab. Clicking this opens a searchable dropdown (similar to "Add Localization") to select a target language. Selecting the target language executes `fs.cpSync()` to copy the current locale's directory (including all text files and images) into a new BCP-47 locale sub-directory, providing a complete starting point for the new localization.
* **Text Editing:** Textareas mapped directly to `title.txt`, `full_description.txt`, etc.
* **Image Management:** 
  * Images are displayed in a responsive grid layout that automatically adapts to the available width of the UI.
  * Drag-and-drop zones mapped to `/screenshots/phone`, etc.
  * Dropping an image triggers absolute path extraction, validation, and `fs.copyFileSync()` into the workspace.
  * Reordering in the UI physically renames the files in the directory (e.g., `01_...`, `02_...`).

## 6. Pre-Flight Validation Engine

The "Publish" button is disabled until the localized payload passes these strict checks:

### 6.1 Text Validation

* `title.txt`: Max 30 characters.
* `short_description.txt`: Max 80 characters.
* `full_description.txt`: Max 4,000 characters.
* Locale Directory Names: Must exactly match Google Play BCP-47 tags (e.g., `es-419`, `en-GB`).

### 6.2 Image Validation

`high_res_icon.png`: Exactly 512x512 px. Max 1MB. (PNG/JPEG)
`feature_graphic.png`: Exactly 1024x500 px. Max 1MB. (PNG/JPEG)
`screenshots/*`: Min length 320px, Max length 3840px. Max aspect ratio 2:1. (PNG/JPEG)

## 7. Google Play API Integration Strategy

### 7.1 Authentication

The application requires a **Google Cloud Service Account JSON Key** with "Editor" access to the Google Play Console. Path to this key should be stored in an ignored `.env` file or global app settings.

### 7.2 The Publish Transaction Flow (Write)

When pushing a release, the Node backend executes the following sequential steps using the Google APIs Client Library (googleapis):

1. **Initialize Edit:** `play.edits.insert({ packageName })` -> Returns `editId`.
1. **Push Global Details:** `play.edits.details.update()` using data from `app_details.json`.
1. **Iterate Locales:** Loop through each locale folder (e.g., `en-US`):
    * Push texts via play.edits.listings.update().
    * Push graphics (Icon, Feature) via play.edits.images.upload().
    * Sort screenshots alphanumerically, then push sequentially to the respective image types (phone, sevenInch, tenInch) via `play.edits.images.upload()`.
1. **Commit:** `play.edits.commit({ editId })`.
1. **Post-Commit Hook:** Update `app_config.json -> liveVersionDir` to match the newly published folder.

### 7.3 The "Import Live" Transaction Flow (Read)

When importing the current live state, the backend uses the API as a read-only snapshot:

1. **Initialize Edit:** `play.edits.insert({ packageName })` -> Returns `editId` (creates a read-only snapshot).
1. **Fetch Global Details:** `play.edits.details.get()` -> Overwrites the local `app_details.json`.
1. **Fetch Active Locales:** `play.edits.listings.list()` -> Returns an array of active BCP-47 tags.
1. **Iterate & Download:** For each active locale:
    * **Texts:** `play.edits.listings.get()` -> Write results to `title.txt`, `full_description.txt`, etc.
    * **Images:** Query `play.edits.images.list()` for each image type (`icon`, `featureGraphic`, `phoneScreenshots`, etc.). Download the provided image URLs via a standard HTTP GET request using `fs.createWriteStream()` to save them into their respective local directories.

    _(Note: Target directories for text and images depend on where the action was triggered. If from the Dashboard, it populates a newly created directory. If from the Editor, it overwrites the currently open directory)._
1. **Clean Up:** Do not commit the edit. Let the `editId` safely expire since no changes were pushed.

### 7.4 Known API Limitations

* **Genesis Upload:** The app cannot create a completely new app package. The first APK/AAB and initial store setup must be done manually in the web console.
* **Privacy Policy:** Must be managed manually in the Play Console under "App Content".
* **Release Notes:** "What's new" texts are tied to APK track deployments (`play.edits.tracks.update`), not the main store listing, and are handled outside the scope of this visual manager.