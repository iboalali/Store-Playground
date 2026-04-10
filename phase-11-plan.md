# Phase 11: Play Console Finance Download

## Goal

Add the ability to download earnings reports directly from Google Play Console's Google Cloud Storage (GCS) bucket, eliminating the need for manual CSV export. The feature auto-detects new months and imports them through the existing CSV pipeline.

## Background

Google Play deposits monthly earnings reports as CSV files (sometimes zipped) in a GCS bucket at `gs://pubsite_prod_rev_<DEVELOPER_ID>/earnings/`. These can be accessed via the Google Cloud Storage JSON API using a service account with `Storage Object Viewer` permissions.

The app already has:
- A full CSV parsing + import pipeline in `src/main/services/reports.ts`
- Service account auth via `googleapis` in `src/main/services/google-play/auth.ts`
- A `CsvImporter` UI component for manual file import

## Design Decisions

- **Bucket config**: User provides the full bucket name (e.g. `pubsite_prod_rev_01234567890`) in Settings
- **Download mode**: Auto-download new only — compare remote months against local index, skip already-imported ones
- **ZIP support**: Detect `.zip` files, extract CSV inside, then import. Uses `adm-zip` dependency
- **No new GCS library**: Uses `googleapis` (already installed) for GCS access via `google.storage({ version: 'v1' })`
- **Reuse existing pipeline**: Downloaded CSVs go through the same `importCsv()` path as manual imports

## New Dependency

- `adm-zip` (^0.5.16) — ZIP extraction for compressed earnings report archives
- `@types/adm-zip` (^0.5.8) — TypeScript type definitions (devDependency)

## Implementation

### Shared Types

**`src/shared/types/models.ts`:**
- Added `playConsoleBucketId: string | null` to `Settings` interface
- Added `EarningsReportInfo { objectName, monthKey, sizeBytes }`
- Added `DownloadRemoteResult { imported, skipped, errors }`

**`src/shared/types/ipc-channels.ts`:**
- Added `REPORTS_LIST_REMOTE = 'reports:list-remote'`
- Added `REPORTS_DOWNLOAD_REMOTE = 'reports:download-remote'`

**`src/shared/types/ipc-payloads.ts`:**
- Added `ReportsListRemoteRequest`, `ReportsListRemoteResponse`
- Added `ReportsDownloadRemoteRequest`, `ReportsDownloadRemoteResponse`

### Main Process

**`src/main/services/settings.ts`:**
- Added `playConsoleBucketId: null` to `DEFAULT_SETTINGS`

**`src/main/services/google-play/auth.ts`:**
- Added `getStorageClient(keyPath)` — creates and caches a `google.storage` v1 client
- Scope: `https://www.googleapis.com/auth/devstorage.read_only`

**`src/main/services/google-play/finance-download.ts` (new file):**
- `listEarningsReports(keyPath, bucketId)` — lists objects in `earnings/` prefix, parses filenames to extract month keys
- `downloadAndImportNewReports(keyPath, bucketId, workspacePath)` — orchestrator:
  1. Lists remote reports via GCS API
  2. Reads local index to find already-imported months
  3. Downloads new reports to temp directory
  4. Extracts ZIPs with `adm-zip` if needed
  5. Calls existing `importCsv()` for each CSV
  6. Cleans up temp files
  7. Returns `{ imported, skipped, errors }`

**`src/main/ipc/reports-handlers.ts`:**
- Added handler for `REPORTS_LIST_REMOTE`
- Added handler for `REPORTS_DOWNLOAD_REMOTE`

### Preload Bridge

**`src/preload/index.ts`:**
- Added `listRemoteReports(args)` bridge method
- Added `downloadRemoteReports(args)` bridge method

### Renderer

**`src/renderer/src/env.d.ts`:**
- Added `listRemoteReports()` and `downloadRemoteReports()` to `Api` interface

**`src/renderer/src/lib/ipc.ts`:**
- Added `listRemoteReports()` and `downloadRemoteReports()` wrapper methods

**`src/renderer/src/stores/settings.svelte.ts`:**
- Added `playConsoleBucketId` state field
- Added `setPlayConsoleBucketId()` method
- Updated `load()` and `resetAll()` to include the new field

**`src/renderer/src/stores/reports.svelte.ts`:**
- Added `downloading` and `downloadResult` state
- Added `downloadFromPlayConsole()` method that validates settings, calls IPC, and refreshes views

**`src/renderer/src/screens/Settings.svelte`:**
- Added "Play Console Bucket" section with text input
- Input saves on blur or Enter keypress

**`src/renderer/src/components/reports/CsvImporter.svelte`:**
- Added "Download from Play Console" button at top of importer body
- Shows download progress, success summary, and per-report errors
- Added "or import manually" divider before existing drop zone
- Existing manual import preserved as fallback

### Documentation

**`README.md`:**
- Added "Finance Report Download Setup" section with GCS setup instructions

**`implementation-plan.md`:**
- Added Phase 11 section with full feature description
- Updated project structure tree
- Updated end-to-end verification steps
- Added Phase 11 to completed phases list

**`tech-document.md`:**
- Updated Technology Stack (Section 2) with GCS API and adm-zip
- Added `reports:list-remote` and `reports:download-remote` to IPC channels (Section 3.2)
- Updated Settings Page (Section 6) with `playConsoleBucketId` field
- Added "GCS Download (Automatic)" subsection to Financial Reports screen (Section 6)
- Updated Authentication (Section 9.1) with GCS scope and IAM role requirements

## Files Modified

| File | Change |
|---|---|
| `package.json` | Add `adm-zip` + `@types/adm-zip` |
| `src/shared/types/models.ts` | Add `playConsoleBucketId` to Settings, add `EarningsReportInfo`, `DownloadRemoteResult` |
| `src/shared/types/ipc-channels.ts` | Add 2 new channel constants + union entries |
| `src/shared/types/ipc-payloads.ts` | Add 2 new request/response types |
| `src/main/services/settings.ts` | Add default for new field |
| `src/main/services/google-play/auth.ts` | Add `getStorageClient()` |
| `src/main/services/google-play/finance-download.ts` | **New file** |
| `src/main/ipc/reports-handlers.ts` | Add 2 new handlers |
| `src/preload/index.ts` | Add 2 new bridge methods |
| `src/renderer/src/env.d.ts` | Add 2 new Api methods |
| `src/renderer/src/lib/ipc.ts` | Add 2 new wrapper methods |
| `src/renderer/src/stores/settings.svelte.ts` | Add bucket ID state + methods |
| `src/renderer/src/stores/reports.svelte.ts` | Add download state + method |
| `src/renderer/src/screens/Settings.svelte` | Add bucket ID input section |
| `src/renderer/src/components/reports/CsvImporter.svelte` | Add download button + states |
| `README.md` | Add GCS setup instructions |
| `implementation-plan.md` | Add Phase 11 |
| `tech-document.md` | Update multiple sections |

## Verification

1. `npm install` — `adm-zip` installs cleanly
2. `npm run typecheck` — no type errors across the full IPC chain
3. Settings round-trip: enter bucket name → restart app → verify it persists
4. With valid service account + bucket: click "Download from Play Console" → new months appear in reports index
5. Click download again → "0 imported, N skipped" (incremental)
6. Test error cases: missing bucket config, invalid bucket name, insufficient permissions
7. Manual CSV import still works alongside the new download feature
