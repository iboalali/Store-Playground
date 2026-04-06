import type { Settings, AppConfig, AppDetails, AppEntry, VersionEntry } from './models'

// Generic result wrapper — every IPC handler returns this
export type IpcResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

// settings:get — no args, returns Settings
export type SettingsGetResponse = IpcResult<Settings>

// settings:set — partial update, returns updated Settings
export type SettingsSetRequest = Partial<Settings>
export type SettingsSetResponse = IpcResult<Settings>

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
