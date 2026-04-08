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

// Menu channels (Main → Renderer push)
export const MENU_ACTION = 'menu:action' as const

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
  | typeof FS_READ_TEXT_FILE
  | typeof FS_WRITE_TEXT_FILE
  | typeof FS_LIST_DIRECTORY
  | typeof FS_READ_JSON_FILE
  | typeof FS_WRITE_IMAGE_DATA
  | typeof VALIDATION_VALIDATE_VERSION
  | typeof API_PUBLISH
  | typeof API_IMPORT_LIVE
  | typeof API_PROGRESS
  | typeof WATCHER_CHANGE
  | typeof MENU_ACTION
