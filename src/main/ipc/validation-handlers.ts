import { ipcMain } from 'electron'
import { VALIDATION_VALIDATE_VERSION } from '$shared/types/ipc-channels'
import type { ValidationValidateVersionRequest, IpcResult } from '$shared/types/ipc-payloads'
import type { ValidationReport } from '$shared/types/models'
import { validateVersionForPublish } from '../services/validation'

export function registerValidationHandlers(): void {
  ipcMain.handle(
    VALIDATION_VALIDATE_VERSION,
    async (
      _event,
      args: ValidationValidateVersionRequest
    ): Promise<IpcResult<ValidationReport>> => {
      try {
        const report = await validateVersionForPublish(args.versionDir)
        return { success: true, data: report }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )
}
