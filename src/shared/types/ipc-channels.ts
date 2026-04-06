// Settings channels
export const SETTINGS_GET = 'settings:get' as const
export const SETTINGS_SET = 'settings:set' as const

// Native dialog channels
export const DIALOG_OPEN_DIRECTORY = 'dialog:open-directory' as const
export const DIALOG_OPEN_FILE = 'dialog:open-file' as const

// Union of all active IPC channels
export type IpcChannel =
  | typeof SETTINGS_GET
  | typeof SETTINGS_SET
  | typeof DIALOG_OPEN_DIRECTORY
  | typeof DIALOG_OPEN_FILE
