import { ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { access } from 'node:fs/promises'
import { is } from '@electron-toolkit/utils'
import {
  FS_READ_WORKSPACE,
  FS_READ_APP_CONFIG,
  FS_CREATE_DIRECTORY,
  FS_WRITE_JSON_FILE,
  FS_COPY_IMAGE,
  FS_DELETE_TO_TRASH,
  FS_CREATE_APP,
  FS_READ_APP_DETAILS,
  FS_LIST_VERSIONS,
  FS_COPY_DIRECTORY,
  FS_RENAME_ITEM
} from '$shared/types/ipc-channels'
import type {
  FsReadWorkspaceRequest,
  FsReadAppConfigRequest,
  FsCreateDirectoryRequest,
  FsWriteJsonFileRequest,
  FsCopyImageRequest,
  FsDeleteToTrashRequest,
  FsCreateAppRequest,
  FsReadAppDetailsRequest,
  FsListVersionsRequest,
  FsCopyDirectoryRequest,
  FsRenameItemRequest,
  IpcResult
} from '$shared/types/ipc-payloads'
import type { AppEntry, AppConfig, AppDetails, VersionEntry } from '$shared/types/models'
import * as filesystem from '../services/filesystem'

function getDefaultIconPath(): string {
  return is.dev
    ? join(process.cwd(), 'resources', 'default-app-icon.png')
    : join(process.resourcesPath, 'default-app-icon.png')
}

export function registerFsHandlers(): void {
  ipcMain.handle(
    FS_READ_WORKSPACE,
    async (_event, args: FsReadWorkspaceRequest): Promise<IpcResult<AppEntry[]>> => {
      try {
        const apps = await filesystem.readWorkspace(args.workspacePath)
        return { success: true, data: apps }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

  ipcMain.handle(
    FS_READ_APP_CONFIG,
    async (_event, args: FsReadAppConfigRequest): Promise<IpcResult<AppConfig>> => {
      try {
        const config = await filesystem.readAppConfig(args.appPath)
        return { success: true, data: config }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

  ipcMain.handle(
    FS_CREATE_DIRECTORY,
    async (_event, args: FsCreateDirectoryRequest): Promise<IpcResult<void>> => {
      try {
        await filesystem.createDirectory(args.dirPath)
        return { success: true, data: undefined }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

  ipcMain.handle(
    FS_WRITE_JSON_FILE,
    async (_event, args: FsWriteJsonFileRequest): Promise<IpcResult<void>> => {
      try {
        await filesystem.writeJsonFile(args.filePath, args.data)
        return { success: true, data: undefined }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

  ipcMain.handle(
    FS_COPY_IMAGE,
    async (_event, args: FsCopyImageRequest): Promise<IpcResult<void>> => {
      try {
        await filesystem.copyImage(args.src, args.dest)
        return { success: true, data: undefined }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

  ipcMain.handle(
    FS_DELETE_TO_TRASH,
    async (_event, args: FsDeleteToTrashRequest): Promise<IpcResult<void>> => {
      try {
        await shell.trashItem(args.itemPath)
        return { success: true, data: undefined }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

  ipcMain.handle(
    FS_CREATE_APP,
    async (_event, args: FsCreateAppRequest): Promise<IpcResult<AppEntry>> => {
      try {
        const appPath = join(args.workspacePath, args.appName)

        // Check if directory already exists
        try {
          await access(appPath)
          return { success: false, error: `App directory "${args.appName}" already exists` }
        } catch {
          // Directory doesn't exist — proceed
        }

        // Create app directory
        await filesystem.createDirectory(appPath)

        // Write app_config.json
        const config: AppConfig = {
          appName: args.appName,
          packageName: args.packageName,
          liveVersionDir: null
        }
        await filesystem.writeJsonFile(join(appPath, 'app_config.json'), config)

        // Write app_details.json with defaults
        const details: AppDetails = {
          defaultLanguage: 'en-US',
          contactEmail: '',
          contactWebsite: '',
          contactPhone: '',
          privacyPolicyUrl: ''
        }
        await filesystem.writeJsonFile(join(appPath, 'app_details.json'), details)

        // Copy default icon
        let hasIcon = false
        try {
          const defaultIconPath = getDefaultIconPath()
          await filesystem.copyImage(defaultIconPath, join(appPath, 'icon.png'))
          hasIcon = true
        } catch {
          // Default icon not available — app still created without icon
        }

        return { success: true, data: { appPath, config, hasIcon } }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

  ipcMain.handle(
    FS_READ_APP_DETAILS,
    async (_event, args: FsReadAppDetailsRequest): Promise<IpcResult<AppDetails>> => {
      try {
        const details = await filesystem.readAppDetails(args.appPath)
        return { success: true, data: details }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

  ipcMain.handle(
    FS_LIST_VERSIONS,
    async (_event, args: FsListVersionsRequest): Promise<IpcResult<VersionEntry[]>> => {
      try {
        const config = await filesystem.readAppConfig(args.appPath)
        const rawVersions = await filesystem.listVersions(args.appPath)
        const versions: VersionEntry[] = rawVersions.map((v) => ({
          ...v,
          isLive: v.dirName === config.liveVersionDir
        }))
        return { success: true, data: versions }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

  ipcMain.handle(
    FS_COPY_DIRECTORY,
    async (_event, args: FsCopyDirectoryRequest): Promise<IpcResult<void>> => {
      try {
        await filesystem.copyDirectory(args.src, args.dest)
        return { success: true, data: undefined }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

  ipcMain.handle(
    FS_RENAME_ITEM,
    async (_event, args: FsRenameItemRequest): Promise<IpcResult<void>> => {
      try {
        await filesystem.renameItem(args.oldPath, args.newPath)
        return { success: true, data: undefined }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )
}
