import { ipcMain } from 'electron'
import {
  REPORTS_IMPORT_CSV,
  REPORTS_GET_INDEX,
  REPORTS_GET_MONTH,
  REPORTS_GET_AGGREGATION,
  REPORTS_DELETE_MONTH,
  REPORTS_LIST_REMOTE,
  REPORTS_DOWNLOAD_REMOTE
} from '$shared/types/ipc-channels'
import type {
  ReportsImportCsvRequest,
  ReportsGetIndexRequest,
  ReportsGetMonthRequest,
  ReportsGetAggregationRequest,
  ReportsDeleteMonthRequest,
  ReportsListRemoteRequest,
  ReportsDownloadRemoteRequest,
  IpcResult
} from '$shared/types/ipc-payloads'
import type { ImportSummary, ReportsIndex, Transaction, AggregationResult, EarningsReportInfo, DownloadRemoteResult } from '$shared/types/models'
import * as reports from '../services/reports'
import { listEarningsReports, downloadAndImportNewReports } from '../services/google-play/finance-download'

export function registerReportsHandlers(): void {
  ipcMain.handle(
    REPORTS_IMPORT_CSV,
    async (_event, args: ReportsImportCsvRequest): Promise<IpcResult<ImportSummary>> => {
      try {
        const result = await reports.importCsv(args.csvPath, args.workspacePath)
        return { success: true, data: result }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

  ipcMain.handle(
    REPORTS_GET_INDEX,
    async (_event, args: ReportsGetIndexRequest): Promise<IpcResult<ReportsIndex>> => {
      try {
        const result = await reports.getIndex(args.workspacePath)
        return { success: true, data: result }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

  ipcMain.handle(
    REPORTS_GET_MONTH,
    async (_event, args: ReportsGetMonthRequest): Promise<IpcResult<Transaction[]>> => {
      try {
        const result = await reports.getMonth(args.workspacePath, args.monthKey)
        return { success: true, data: result }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

  ipcMain.handle(
    REPORTS_GET_AGGREGATION,
    async (_event, args: ReportsGetAggregationRequest): Promise<IpcResult<AggregationResult>> => {
      try {
        const result = await reports.getAggregation(
          args.workspacePath,
          args.monthKeys,
          args.appPackageName
        )
        return { success: true, data: result }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

  ipcMain.handle(
    REPORTS_DELETE_MONTH,
    async (_event, args: ReportsDeleteMonthRequest): Promise<IpcResult<void>> => {
      try {
        await reports.deleteMonth(args.workspacePath, args.monthKey)
        return { success: true, data: undefined }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

  ipcMain.handle(
    REPORTS_LIST_REMOTE,
    async (_event, args: ReportsListRemoteRequest): Promise<IpcResult<EarningsReportInfo[]>> => {
      try {
        const result = await listEarningsReports(args.serviceAccountKeyPath, args.bucketId)
        return { success: true, data: result }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )

  ipcMain.handle(
    REPORTS_DOWNLOAD_REMOTE,
    async (_event, args: ReportsDownloadRemoteRequest): Promise<IpcResult<DownloadRemoteResult>> => {
      try {
        const result = await downloadAndImportNewReports(
          args.serviceAccountKeyPath,
          args.bucketId,
          args.workspacePath
        )
        return { success: true, data: result }
      } catch (err) {
        return { success: false, error: String(err) }
      }
    }
  )
}
