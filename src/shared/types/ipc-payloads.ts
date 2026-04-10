import type { Settings, AppConfig, AppDetails, AppEntry, VersionEntry, DirectoryEntry, ValidationReport, ProgressEvent, ImportSummary, ReportsIndex, Transaction, AggregationResult, EarningsReportInfo, DownloadRemoteResult } from './models'

// Generic result wrapper — every IPC handler returns this
export type IpcResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

// settings:get — no args, returns Settings
export type SettingsGetResponse = IpcResult<Settings>

// settings:set — partial update, returns updated Settings
export type SettingsSetRequest = Partial<Settings>
export type SettingsSetResponse = IpcResult<Settings>

// settings:reset-all — no args, resets settings + trashes workspace contents
export type SettingsResetAllResponse = IpcResult<void>

// dialog:open-directory — optional config, returns path or null (cancelled)
export interface DialogOpenDirectoryRequest {
  title?: string
  defaultPath?: string
}
export type DialogOpenDirectoryResponse = IpcResult<string | null>

// dialog:open-file — optional config with filters, returns path or null (cancelled)
export interface DialogOpenFileRequest {
  title?: string
  defaultPath?: string
  filters?: Array<{ name: string; extensions: string[] }>
}
export type DialogOpenFileResponse = IpcResult<string | null>

// fs:read-workspace — scan workspace, returns app entries
export interface FsReadWorkspaceRequest {
  workspacePath: string
}
export type FsReadWorkspaceResponse = IpcResult<AppEntry[]>

// fs:read-app-config — read a single app's config
export interface FsReadAppConfigRequest {
  appPath: string
}
export type FsReadAppConfigResponse = IpcResult<AppConfig>

// fs:create-directory — create a directory recursively
export interface FsCreateDirectoryRequest {
  dirPath: string
}
export type FsCreateDirectoryResponse = IpcResult<void>

// fs:write-json-file — write JSON data to a file
export interface FsWriteJsonFileRequest {
  filePath: string
  data: unknown
}
export type FsWriteJsonFileResponse = IpcResult<void>

// fs:copy-image — copy an image file
export interface FsCopyImageRequest {
  src: string
  dest: string
}
export type FsCopyImageResponse = IpcResult<void>

// fs:delete-to-trash — move item to OS trash
export interface FsDeleteToTrashRequest {
  itemPath: string
}
export type FsDeleteToTrashResponse = IpcResult<void>

// fs:create-app — atomic app creation (dir + configs + icon)
export interface FsCreateAppRequest {
  workspacePath: string
  appName: string
  packageName: string
}
export type FsCreateAppResponse = IpcResult<AppEntry>

// fs:read-app-details — read app_details.json
export interface FsReadAppDetailsRequest {
  appPath: string
}
export type FsReadAppDetailsResponse = IpcResult<AppDetails>

// fs:list-versions — scan app dir for version subdirectories
export interface FsListVersionsRequest {
  appPath: string
}
export type FsListVersionsResponse = IpcResult<VersionEntry[]>

// fs:copy-directory — recursive directory copy
export interface FsCopyDirectoryRequest {
  src: string
  dest: string
}
export type FsCopyDirectoryResponse = IpcResult<void>

// fs:rename-item — rename a file or directory
export interface FsRenameItemRequest {
  oldPath: string
  newPath: string
}
export type FsRenameItemResponse = IpcResult<void>

// fs:read-text-file — read a text file's content
export interface FsReadTextFileRequest {
  filePath: string
}
export type FsReadTextFileResponse = IpcResult<string>

// fs:write-text-file — write text content to a file
export interface FsWriteTextFileRequest {
  filePath: string
  content: string
}
export type FsWriteTextFileResponse = IpcResult<void>

// fs:list-directory — list files/dirs in a directory
export interface FsListDirectoryRequest {
  dirPath: string
}
export type FsListDirectoryResponse = IpcResult<DirectoryEntry[]>

// fs:read-json-file — generic JSON file reader
export interface FsReadJsonFileRequest {
  filePath: string
}
export type FsReadJsonFileResponse = IpcResult<unknown>

// fs:write-image-data — write base64 image data to disk (clipboard paste)
export interface FsWriteImageDataRequest {
  destPath: string
  base64Data: string
}
export type FsWriteImageDataResponse = IpcResult<void>

// validation:validate-version — validate a version directory for publish readiness
export interface ValidationValidateVersionRequest {
  versionDir: string
}
export type ValidationValidateVersionResponse = IpcResult<ValidationReport>

// api:publish — publish a version directory to Google Play
export interface ApiPublishRequest {
  packageName: string
  serviceAccountKeyPath: string
  versionDir: string
  appPath: string
}
export type ApiPublishResponse = IpcResult<void>

// api:import-live — import live listing from Google Play to local filesystem
export interface ApiImportLiveRequest {
  packageName: string
  serviceAccountKeyPath: string
  targetDir: string
  mode: 'new-app' | 'overwrite-version'
}
export type ApiImportLiveResponse = IpcResult<void>

// reports:import-csv — parse CSV, write parsed JSON, update index, copy raw CSV
export interface ReportsImportCsvRequest {
  csvPath: string
  workspacePath: string
}
export type ReportsImportCsvResponse = IpcResult<ImportSummary>

// reports:get-index — read reports_index.json
export interface ReportsGetIndexRequest {
  workspacePath: string
}
export type ReportsGetIndexResponse = IpcResult<ReportsIndex>

// reports:get-month — read parsed month JSON
export interface ReportsGetMonthRequest {
  workspacePath: string
  monthKey: string
}
export type ReportsGetMonthResponse = IpcResult<Transaction[]>

// reports:get-aggregation — compute aggregations on the fly
export interface ReportsGetAggregationRequest {
  workspacePath: string
  monthKeys: string[]
  appPackageName?: string
}
export type ReportsGetAggregationResponse = IpcResult<AggregationResult>

// reports:delete-month — remove month data + update index
export interface ReportsDeleteMonthRequest {
  workspacePath: string
  monthKey: string
}
export type ReportsDeleteMonthResponse = IpcResult<void>

// reports:list-remote — list available earnings reports in GCS bucket
export interface ReportsListRemoteRequest {
  serviceAccountKeyPath: string
  bucketId: string
}
export type ReportsListRemoteResponse = IpcResult<EarningsReportInfo[]>

// reports:download-remote — download new earnings reports from GCS and import them
export interface ReportsDownloadRemoteRequest {
  serviceAccountKeyPath: string
  bucketId: string
  workspacePath: string
}
export type ReportsDownloadRemoteResponse = IpcResult<DownloadRemoteResult>

// Menu action names dispatched from main menu to renderer
export type MenuAction =
  | 'new-app'
  | 'open-workspace'
  | 'settings'
  | 'save'
  | 'new-listing'
  | 'refresh'
  | 'toggle-archived'
  | 'publish'
  | 'import-live'
  | 'add-localization'
