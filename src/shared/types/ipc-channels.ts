// Settings channels
export const SETTINGS_GET = 'settings:get' as const
export const SETTINGS_SET = 'settings:set' as const
export const SETTINGS_RESET_ALL = 'settings:reset-all' as const

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
export const FS_READ_TEXT_FILE = 'fs:read-text-file' as const
export const FS_WRITE_TEXT_FILE = 'fs:write-text-file' as const
export const FS_LIST_DIRECTORY = 'fs:list-directory' as const
export const FS_READ_JSON_FILE = 'fs:read-json-file' as const
export const FS_WRITE_IMAGE_DATA = 'fs:write-image-data' as const

// Validation channels
export const VALIDATION_VALIDATE_VERSION = 'validation:validate-version' as const

// API channels
export const API_PUBLISH = 'api:publish' as const
export const API_IMPORT_LIVE = 'api:import-live' as const
export const API_PROGRESS = 'api:progress' as const

// Watcher channels (Main → Renderer push)
export const WATCHER_CHANGE = 'watcher:change' as const

// Reports channels
export const REPORTS_IMPORT_CSV = 'reports:import-csv' as const
export const REPORTS_GET_INDEX = 'reports:get-index' as const
export const REPORTS_GET_MONTH = 'reports:get-month' as const
export const REPORTS_GET_AGGREGATION = 'reports:get-aggregation' as const
export const REPORTS_DELETE_MONTH = 'reports:delete-month' as const
export const REPORTS_LIST_REMOTE = 'reports:list-remote' as const
export const REPORTS_DOWNLOAD_REMOTE = 'reports:download-remote' as const

// Menu channels (Main → Renderer push)
export const MENU_ACTION = 'menu:action' as const

// Union of all active IPC channels
export type IpcChannel =
  | typeof SETTINGS_GET
  | typeof SETTINGS_SET
  | typeof SETTINGS_RESET_ALL
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
  | typeof FS_READ_TEXT_FILE
  | typeof FS_WRITE_TEXT_FILE
  | typeof FS_LIST_DIRECTORY
  | typeof FS_READ_JSON_FILE
  | typeof FS_WRITE_IMAGE_DATA
  | typeof VALIDATION_VALIDATE_VERSION
  | typeof API_PUBLISH
  | typeof API_IMPORT_LIVE
  | typeof API_PROGRESS
  | typeof REPORTS_IMPORT_CSV
  | typeof REPORTS_GET_INDEX
  | typeof REPORTS_GET_MONTH
  | typeof REPORTS_GET_AGGREGATION
  | typeof REPORTS_DELETE_MONTH
  | typeof REPORTS_LIST_REMOTE
  | typeof REPORTS_DOWNLOAD_REMOTE
  | typeof WATCHER_CHANGE
  | typeof MENU_ACTION
