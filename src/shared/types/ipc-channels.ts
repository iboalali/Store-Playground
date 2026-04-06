// Settings channels
export const SETTINGS_GET = 'settings:get' as const
export const SETTINGS_SET = 'settings:set' as const

// Native dialog channels
export const DIALOG_OPEN_DIRECTORY = 'dialog:open-directory' as const
export const DIALOG_OPEN_FILE = 'dialog:open-file' as const

// Filesystem channels
export const FS_READ_WORKSPACE = 'fs:read-workspace' as const
export const FS_READ_APP_CONFIG = 'fs:read-app-config' as const
export const FS_CREATE_DIRECTORY = 'fs:create-directory' as const
export const FS_WRITE_JSON_FILE = 'fs:write-json-file' as const
export const FS_COPY_IMAGE = 'fs:copy-image' as const
export const FS_DELETE_TO_TRASH = 'fs:delete-to-trash' as const
export const FS_CREATE_APP = 'fs:create-app' as const
export const FS_READ_APP_DETAILS = 'fs:read-app-details' as const
export const FS_LIST_VERSIONS = 'fs:list-versions' as const
export const FS_COPY_DIRECTORY = 'fs:copy-directory' as const
export const FS_RENAME_ITEM = 'fs:rename-item' as const

// Union of all active IPC channels
export type IpcChannel =
  | typeof SETTINGS_GET
  | typeof SETTINGS_SET
  | typeof DIALOG_OPEN_DIRECTORY
  | typeof DIALOG_OPEN_FILE
  | typeof FS_READ_WORKSPACE
  | typeof FS_READ_APP_CONFIG
  | typeof FS_CREATE_DIRECTORY
  | typeof FS_WRITE_JSON_FILE
  | typeof FS_COPY_IMAGE
  | typeof FS_DELETE_TO_TRASH
  | typeof FS_CREATE_APP
  | typeof FS_READ_APP_DETAILS
  | typeof FS_LIST_VERSIONS
  | typeof FS_COPY_DIRECTORY
  | typeof FS_RENAME_ITEM
