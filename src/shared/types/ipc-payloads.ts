import type { Settings } from './models'

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
