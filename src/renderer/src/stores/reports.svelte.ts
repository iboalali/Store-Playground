import { ipc } from '$lib/ipc'
import type {
  ReportsIndex,
  Transaction,
  AggregationResult,
  DownloadRemoteResult
} from '$shared/types/models'

class ReportsStore {
  index: ReportsIndex | null = $state(null)
  selectedMonths: string[] = $state([])
  currentAppPackage: string = $state('')
  appPath: string = $state('')
  aggregations: AggregationResult | null = $state(null)
  transactions: Transaction[] = $state([])
  loading = $state(false)
  error: string | null = $state(null)
  importing = $state(false)
  importerExpanded = $state(false)
  downloading = $state(false)
  downloadResult: DownloadRemoteResult | null = $state(null)
  viewMode: 'app' | 'all' = $state('app')

  // Transaction table state
  transactionPage = $state(0)
  transactionPageSize = $state(50)
  transactionFilter: 'all' | 'charges' | 'refunds' = $state('all')
  transactionSortColumn: string = $state('date')
  transactionSortDir: 'asc' | 'desc' = $state('desc')

  availableMonths = $derived.by(() => {
    if (!this.index) return []
    return this.index.importedFiles
      .map((f) => f.monthKey)
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort()
      .reverse()
  })

  activeAppFilter = $derived(this.viewMode === 'app' ? this.currentAppPackage : undefined)

  filteredTransactions = $derived.by(() => {
    let txs = this.transactions
    if (this.activeAppFilter) {
      txs = txs.filter((tx) => tx.productId === this.activeAppFilter)
    }
    if (this.transactionFilter === 'charges') {
      txs = txs.filter((tx) => tx.type === 'charge')
    } else if (this.transactionFilter === 'refunds') {
      txs = txs.filter((tx) => tx.type === 'charge-refund')
    }

    // Sort
    const col = this.transactionSortColumn
    const dir = this.transactionSortDir === 'asc' ? 1 : -1
    txs = [...txs].sort((a, b) => {
      const av = a[col as keyof Transaction]
      const bv = b[col as keyof Transaction]
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av ?? '').localeCompare(String(bv ?? '')) * dir
    })

    return txs
  })

  paginatedTransactions = $derived.by(() => {
    const start = this.transactionPage * this.transactionPageSize
    return this.filteredTransactions.slice(start, start + this.transactionPageSize)
  })

  totalPages = $derived(
    Math.max(1, Math.ceil(this.filteredTransactions.length / this.transactionPageSize))
  )

  private workspacePath: string = ''

  async load(appPath: string): Promise<void> {
    this.appPath = appPath
    this.viewMode = 'app'
    this.loading = true
    this.error = null

    try {
      // Read app config to get package name
      const config = await ipc.readAppConfig(appPath)
      this.currentAppPackage = config.packageName

      // Get workspace path from settings
      const settings = await ipc.getSettings()
      if (!settings.workspacePath) {
        throw new Error('No workspace configured')
      }
      this.workspacePath = settings.workspacePath

      // Load index
      this.index = await ipc.getReportsIndex(this.workspacePath)

      // Auto-select latest 6 months
      const available = this.availableMonths
      this.selectedMonths = available.slice(0, 6)

      if (this.selectedMonths.length > 0) {
        await this.computeAggregations()
        await this.loadTransactions()
      }
    } catch (err) {
      this.error = String(err)
    } finally {
      this.loading = false
    }
  }

  async loadGlobal(): Promise<void> {
    this.appPath = ''
    this.currentAppPackage = ''
    this.viewMode = 'all'
    this.loading = true
    this.error = null

    try {
      const settings = await ipc.getSettings()
      if (!settings.workspacePath) {
        throw new Error('No workspace configured')
      }
      this.workspacePath = settings.workspacePath

      this.index = await ipc.getReportsIndex(this.workspacePath)

      const available = this.availableMonths
      this.selectedMonths = available.slice(0, 6)

      if (this.selectedMonths.length > 0) {
        await this.computeAggregations()
        await this.loadTransactions()
      }
    } catch (err) {
      this.error = String(err)
    } finally {
      this.loading = false
    }
  }

  async reload(): Promise<void> {
    if (this.appPath) {
      await this.load(this.appPath)
    } else {
      await this.loadGlobal()
    }
  }

  async importCsv(csvPath: string): Promise<void> {
    if (!this.workspacePath) return
    this.importing = true
    this.error = null

    try {
      await ipc.importCsv(csvPath, this.workspacePath)
      // Reload index and refresh
      this.index = await ipc.getReportsIndex(this.workspacePath)

      const available = this.availableMonths
      if (this.selectedMonths.length === 0) {
        this.selectedMonths = available.slice(0, 6)
      }

      await this.computeAggregations()
      await this.loadTransactions()
    } catch (err) {
      this.error = String(err)
    } finally {
      this.importing = false
    }
  }

  async selectMonths(months: string[]): Promise<void> {
    this.selectedMonths = months
    this.transactionPage = 0
    await this.computeAggregations()
    await this.loadTransactions()
  }

  async computeAggregations(): Promise<void> {
    if (!this.workspacePath || this.selectedMonths.length === 0) {
      this.aggregations = null
      return
    }

    try {
      this.aggregations = await ipc.getReportsAggregation(
        this.workspacePath,
        this.selectedMonths,
        this.activeAppFilter
      )
    } catch (err) {
      this.error = String(err)
    }
  }

  async loadTransactions(): Promise<void> {
    if (!this.workspacePath || this.selectedMonths.length === 0) {
      this.transactions = []
      return
    }

    try {
      const allTxs: Transaction[] = []
      for (const month of this.selectedMonths) {
        try {
          const txs = await ipc.getReportsMonth(this.workspacePath, month)
          allTxs.push(...txs)
        } catch {
          // Month may not exist
        }
      }
      this.transactions = allTxs
    } catch (err) {
      this.error = String(err)
    }
  }

  async deleteMonth(monthKey: string): Promise<void> {
    if (!this.workspacePath) return

    try {
      await ipc.deleteReportsMonth(this.workspacePath, monthKey)
      this.index = await ipc.getReportsIndex(this.workspacePath)
      this.selectedMonths = this.selectedMonths.filter((m) => m !== monthKey)

      if (this.selectedMonths.length > 0) {
        await this.computeAggregations()
        await this.loadTransactions()
      } else {
        this.aggregations = null
        this.transactions = []
      }
    } catch (err) {
      this.error = String(err)
    }
  }

  async downloadFromPlayConsole(): Promise<void> {
    this.downloading = true
    this.downloadResult = null
    this.error = null

    try {
      const settings = await ipc.getSettings()
      if (!settings.serviceAccountKeyPath) {
        throw new Error('Service account key not configured. Go to Settings to set it up.')
      }
      if (!settings.playConsoleBucketId) {
        throw new Error('Play Console bucket not configured. Go to Settings to set it up.')
      }
      if (!this.workspacePath) {
        throw new Error('No workspace configured')
      }

      const result = await ipc.downloadRemoteReports(
        settings.serviceAccountKeyPath,
        settings.playConsoleBucketId,
        this.workspacePath
      )
      this.downloadResult = result

      // Reload index and refresh views
      this.index = await ipc.getReportsIndex(this.workspacePath)

      const available = this.availableMonths
      if (this.selectedMonths.length === 0) {
        this.selectedMonths = available.slice(0, 6)
      }

      if (this.selectedMonths.length > 0) {
        await this.computeAggregations()
        await this.loadTransactions()
      }
    } catch (err) {
      this.error = String(err)
    } finally {
      this.downloading = false
    }
  }

  async setViewMode(mode: 'app' | 'all'): Promise<void> {
    this.viewMode = mode
    this.transactionPage = 0
    await this.computeAggregations()
  }

  setTransactionSort(column: string): void {
    if (this.transactionSortColumn === column) {
      this.transactionSortDir = this.transactionSortDir === 'asc' ? 'desc' : 'asc'
    } else {
      this.transactionSortColumn = column
      this.transactionSortDir = 'desc'
    }
    this.transactionPage = 0
  }

  setTransactionFilter(filter: 'all' | 'charges' | 'refunds'): void {
    this.transactionFilter = filter
    this.transactionPage = 0
  }
}

export const reportsStore = new ReportsStore()
