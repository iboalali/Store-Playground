# Phase 9: Financial Reports & Analytics — Implementation Plan

## Context

Phase 9 adds a per-app revenue analytics dashboard to the Store Playground app. Users manually import Google Play Console earnings CSV reports (which contain transactions for ALL apps in their account), and the app parses, stores, and visualizes the data filtered per-app. Phases 1-8 are complete. The router route (`reports`), breadcrumb, and placeholder in `App.svelte` already exist. No report types, IPC channels, services, stores, or components exist yet.

---

## Implementation Steps

### Step 1: Add Shared Types to `src/shared/types/models.ts`

Append after line 137 (end of Phase 7 types section):

```typescript
// --- Phase 9: Financial Reports types ---

export interface ReportsIndex {
  importedFiles: ImportedFile[]
  dateRange: { earliest: string; latest: string }
}

export interface ImportedFile {
  filename: string
  importedAt: string
  monthKey: string      // "2024-12"
  rowCount: number
  apps: string[]        // package names found in CSV
}

export interface Transaction {
  id: string
  date: string          // ISO 8601
  type: 'charge' | 'google-fee' | 'charge-refund' | 'google-fee-refund' | 'tax'
  refundType: string | null
  productId: string
  productTitle: string
  productType: 'one-time' | 'subscription'
  skuId: string | null
  hardware: string
  buyerCountry: string
  buyerState: string
  buyerPostalCode: string
  buyerCurrency: string
  buyerAmount: number
  conversionRate: number
  merchantCurrency: string
  merchantAmount: number
  basePlanId: string | null
  offerId: string | null
  serviceFeePercent: number | null
  firstMillionEligible: boolean
}

export interface MonthlyAggregation {
  month: string
  grossRevenue: number
  googleFees: number
  refunds: number
  netRevenue: number
  totalTransactions: number
  refundCount: number
  refundRate: number
  merchantCurrency: string
}

export interface CountryAggregation {
  country: string
  grossRevenue: number
  transactionCount: number
  percentage: number
}

export interface ProductAggregation {
  productId: string
  productTitle: string
  productType: 'one-time' | 'subscription'
  skuId: string | null
  grossRevenue: number
  transactionCount: number
}

export interface ImportSummary {
  monthKey: string
  rowCount: number
  apps: string[]
  filename: string
}

export interface AggregationResult {
  monthly: MonthlyAggregation[]
  byCountry: CountryAggregation[]
  byProduct: ProductAggregation[]
}
```

Also update the import in `ipc-payloads.ts` line 1 to include new types.

### Step 2: Add IPC Channel Constants to `src/shared/types/ipc-channels.ts`

Add 5 new channel constants after line 39 (before `MENU_ACTION`):

```typescript
// Reports channels
export const REPORTS_IMPORT_CSV = 'reports:import-csv' as const
export const REPORTS_GET_INDEX = 'reports:get-index' as const
export const REPORTS_GET_MONTH = 'reports:get-month' as const
export const REPORTS_GET_AGGREGATION = 'reports:get-aggregation' as const
export const REPORTS_DELETE_MONTH = 'reports:delete-month' as const
```

Add to the `IpcChannel` union type (after line 68):

```typescript
  | typeof REPORTS_IMPORT_CSV
  | typeof REPORTS_GET_INDEX
  | typeof REPORTS_GET_MONTH
  | typeof REPORTS_GET_AGGREGATION
  | typeof REPORTS_DELETE_MONTH
```

### Step 3: Add IPC Payload Types to `src/shared/types/ipc-payloads.ts`

Append after line 170:

```typescript
// reports:import-csv — parse CSV, write parsed JSON, update index, copy raw CSV
export interface ReportsImportCsvRequest {
  csvPath: string
  workspacePath: string
}
export type ReportsImportCsvResponse = IpcResult<ImportSummary>

// reports:get-index — read reports_index.json
export interface ReportsGetIndexRequest {
  workspacePath: string
}
export type ReportsGetIndexResponse = IpcResult<ReportsIndex>

// reports:get-month — read parsed month JSON
export interface ReportsGetMonthRequest {
  workspacePath: string
  monthKey: string
}
export type ReportsGetMonthResponse = IpcResult<Transaction[]>

// reports:get-aggregation — compute aggregations on the fly
export interface ReportsGetAggregationRequest {
  workspacePath: string
  monthKeys: string[]
  appPackageName?: string
}
export type ReportsGetAggregationResponse = IpcResult<AggregationResult>

// reports:delete-month — remove month data + update index
export interface ReportsDeleteMonthRequest {
  workspacePath: string
  monthKey: string
}
export type ReportsDeleteMonthResponse = IpcResult<void>
```

Update the import at line 1 to include `ImportSummary`, `ReportsIndex`, `Transaction`, `AggregationResult`.

### Step 4: Create Reports Service — `src/main/services/reports.ts`

**New file.** Pure functions, no Electron imports. Key functions:

1. **`parseEarningsCsv(csvPath: string): Promise<Map<string, Transaction[]>>`**
   - Read file with `fs.readFile` (UTF-8)
   - Custom line-by-line CSV parser handling quoted fields (commas inside quotes)
   - Parse header row to get column indices
   - Map column names: `Description` -> `id`, `Transaction Date` + `Transaction Time` -> `date` (parse "Dec 1, 2024" + "6:23:05 PM PST" -> ISO 8601), `Transaction Type` -> `type` (normalize to kebab-case), `Product id` -> `productId`, `Amount (Merchant Currency)` -> `merchantAmount`, etc.
   - Group transactions by month key (YYYY-MM from date)
   - Return Map<monthKey, Transaction[]>
   - Edge cases: skip empty rows, handle missing optional fields (skuId, basePlanId, offerId), convert `Product Type` 0->one-time / 1->subscription, parse `First USD 1M Eligible` Yes/No -> boolean

2. **`importCsv(csvPath: string, workspacePath: string): Promise<ImportSummary>`**
   - Call `parseEarningsCsv`
   - Ensure `{workspace}/reports/`, `reports/csv/`, `reports/parsed/` dirs exist (`mkdir -p`)
   - For each month: write `{workspace}/reports/parsed/{monthKey}.json` with `{ month, transactions }`
   - Copy raw CSV to `{workspace}/reports/csv/{filename}`
   - Read existing `reports_index.json` (or create default if missing)
   - Update index: add/replace ImportedFile entry, recalculate dateRange
   - Write updated `reports_index.json`
   - Return ImportSummary

3. **`getIndex(workspacePath: string): Promise<ReportsIndex>`**
   - Read `{workspace}/reports/reports_index.json`
   - Return default `{ importedFiles: [], dateRange: { earliest: '', latest: '' } }` if not found

4. **`getMonth(workspacePath: string, monthKey: string): Promise<Transaction[]>`**
   - Read `{workspace}/reports/parsed/{monthKey}.json`
   - Return transactions array

5. **`getAggregation(workspacePath: string, monthKeys: string[], appFilter?: string): Promise<AggregationResult>`**
   - Load transactions from each month's parsed JSON
   - Filter by appFilter (productId) if provided
   - Call internal aggregation helpers:
     - `aggregateByMonth(transactions)` — group by month, compute grossRevenue (sum of `charge` merchantAmounts), googleFees (sum of `google-fee`), refunds (sum of `charge-refund`), netRevenue, counts, refundRate
     - `aggregateByCountry(transactions)` — group by buyerCountry, sum revenue, calc percentage
     - `aggregateByProduct(transactions)` — group by productId+skuId, sum revenue, count
   - Return `{ monthly, byCountry, byProduct }`

6. **`deleteMonth(workspacePath: string, monthKey: string): Promise<void>`**
   - Delete `{workspace}/reports/parsed/{monthKey}.json`
   - Find & delete matching raw CSV from `{workspace}/reports/csv/`
   - Update `reports_index.json` (remove entry, recalculate dateRange)

**CSV Parser details:**
- No external library per spec
- Handle quoted fields: scan char-by-char, track `insideQuotes` state
- Handle escaped quotes (`""` inside quoted field)
- Parse date: "Dec 1, 2024" with month name map + "6:23:05 PM PST" -> construct ISO date string
- Parse amounts: remove commas from numbers, parseFloat

### Step 5: Create Reports IPC Handlers — `src/main/ipc/reports-handlers.ts`

**New file.** Follow the pattern from `settings-handlers.ts`:

```typescript
import { ipcMain } from 'electron'
import { REPORTS_IMPORT_CSV, REPORTS_GET_INDEX, REPORTS_GET_MONTH, REPORTS_GET_AGGREGATION, REPORTS_DELETE_MONTH } from '$shared/types/ipc-channels'
import type { ... } from '$shared/types/ipc-payloads'
import * as reports from '../services/reports'

export function registerReportsHandlers(): void {
  ipcMain.handle(REPORTS_IMPORT_CSV, async (_event, args: ReportsImportCsvRequest) => {
    try {
      const result = await reports.importCsv(args.csvPath, args.workspacePath)
      return { success: true, data: result }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
  // ... same pattern for all 5 channels
}
```

### Step 6: Register Handlers in `src/main/index.ts`

- Add import: `import { registerReportsHandlers } from './ipc/reports-handlers'`
- Add call after line 54: `registerReportsHandlers()`

### Step 7: Wire Preload Bridge — `src/preload/index.ts`

- Import all 5 new channel constants
- Add 5 methods to the `contextBridge.exposeInMainWorld('api', {...})`:

```typescript
  // Reports
  importCsv: (args: { csvPath: string; workspacePath: string }) =>
    ipcRenderer.invoke(REPORTS_IMPORT_CSV, args),
  getReportsIndex: (args: { workspacePath: string }) =>
    ipcRenderer.invoke(REPORTS_GET_INDEX, args),
  getReportsMonth: (args: { workspacePath: string; monthKey: string }) =>
    ipcRenderer.invoke(REPORTS_GET_MONTH, args),
  getReportsAggregation: (args: { workspacePath: string; monthKeys: string[]; appPackageName?: string }) =>
    ipcRenderer.invoke(REPORTS_GET_AGGREGATION, args),
  deleteReportsMonth: (args: { workspacePath: string; monthKey: string }) =>
    ipcRenderer.invoke(REPORTS_DELETE_MONTH, args),
```

### Step 8: Add Renderer IPC Wrappers — `src/renderer/src/lib/ipc.ts`

- Add import for new types: `ImportSummary`, `ReportsIndex`, `Transaction`, `AggregationResult`
- Add 5 methods to the `ipc` object:

```typescript
  // Reports
  async importCsv(csvPath: string, workspacePath: string): Promise<ImportSummary> {
    return unwrap(await window.api.importCsv({ csvPath, workspacePath }))
  },
  async getReportsIndex(workspacePath: string): Promise<ReportsIndex> {
    return unwrap(await window.api.getReportsIndex({ workspacePath }))
  },
  async getReportsMonth(workspacePath: string, monthKey: string): Promise<Transaction[]> {
    return unwrap(await window.api.getReportsMonth({ workspacePath, monthKey }))
  },
  async getReportsAggregation(workspacePath: string, monthKeys: string[], appPackageName?: string): Promise<AggregationResult> {
    return unwrap(await window.api.getReportsAggregation({ workspacePath, monthKeys, appPackageName }))
  },
  async deleteReportsMonth(workspacePath: string, monthKey: string): Promise<void> {
    return unwrap(await window.api.deleteReportsMonth({ workspacePath, monthKey }))
  },
```

### Step 9: Create Reports Store — `src/renderer/src/stores/reports.svelte.ts`

**New file.** Follow the class-based Svelte 5 runes pattern:

```typescript
class ReportsStore {
  index: ReportsIndex | null = $state(null)
  selectedMonths: string[] = $state([])
  currentAppPackage: string = $state('')
  aggregations: AggregationResult | null = $state(null)
  transactions: Transaction[] = $state([])
  loading = $state(false)
  error: string | null = $state(null)
  importerExpanded = $state(true)
  viewMode: 'app' | 'all' = $state('app')
  // pagination for transaction table
  transactionPage = $state(0)
  transactionPageSize = $state(50)
  transactionFilter: 'all' | 'charges' | 'refunds' = $state('all')
  transactionSort: { column: string; direction: 'asc' | 'desc' } = $state({ column: 'date', direction: 'desc' })

  availableMonths = $derived(/* compute from index.importedFiles sorted descending */)
  filteredTransactions = $derived(/* filter transactions by transactionFilter and currentAppPackage */)
  paginatedTransactions = $derived(/* slice filteredTransactions by page */)
  totalPages = $derived(/* ceil(filteredTransactions.length / pageSize) */)

  async load(appPath: string): Promise<void> { /* load index, set currentAppPackage from app_config.json, auto-select latest 6 months, compute aggregations */ }
  async importCsv(csvPath: string): Promise<void> { /* call ipc.importCsv, reload index, refresh aggregations */ }
  async selectMonths(months: string[]): Promise<void> { /* update selectedMonths, recompute aggregations */ }
  async computeAggregations(): Promise<void> { /* call ipc.getReportsAggregation with selectedMonths + filter */ }
  async deleteMonth(monthKey: string): Promise<void> { /* call ipc.deleteReportsMonth, reload index, refresh */ }
  async loadTransactions(): Promise<void> { /* load Transaction[] for all selectedMonths */ }
  setViewMode(mode: 'app' | 'all'): void { /* toggle app filter, recompute */ }
}

export const reportsStore = new ReportsStore()
```

### Step 10: Install chart.js Dependency

```bash
npm install chart.js
```

Add to `package.json` dependencies. Chart.js will be used for the RevenueChart component. Since this is Electron, bundle size is not a concern.

### Step 11: Build Report Components — `src/renderer/src/components/reports/`

**Create directory** `src/renderer/src/components/reports/`

#### 11a. `CsvImporter.svelte`
- Collapsible section (toggle via store's `importerExpanded`)
- Drop zone: `ondragover`, `ondragenter`, `ondragleave`, `ondrop` handlers
- File picker button using `ipc.openFileDialog({ filters: [{ name: 'CSV', extensions: ['csv'] }] })`
- On drop/pick: call `reportsStore.importCsv(filePath)`
- Show list of already-imported months from `reportsStore.index.importedFiles` with delete button per month
- Import progress/summary feedback

#### 11b. `MonthSelector.svelte`
- Props: available months from store
- Two dropdowns: "From" month and "To" month, populated from `reportsStore.availableMonths`
- Default: latest 6 months (or all if fewer)
- On change: call `reportsStore.selectMonths(selectedRange)`
- Compact horizontal layout

#### 11c. `RevenueSummary.svelte`
- Read `reportsStore.aggregations.monthly`
- 5 summary cards in a horizontal row:
  - Gross Revenue (sum of monthly grossRevenue)
  - Google Fees (sum, show as % of gross)
  - Refunds (sum, show refund rate %)
  - Net Revenue (sum)
  - Transactions (total count)
- Each card shows delta vs. previous equivalent period (e.g., if viewing 3 months, compare to preceding 3 months)
- Delta shown as arrow + percentage change, green for positive, red for negative
- Format currency values with merchantCurrency from aggregation

#### 11d. `RevenueChart.svelte`
- Uses Chart.js with `<canvas>` element
- Bar chart: grossRevenue and netRevenue per month (from `reportsStore.aggregations.monthly`)
- Optional line overlay for fees/refunds
- Initialize Chart.js instance in `$effect`, destroy on cleanup
- Responsive sizing
- Hover tooltips with exact values + currency

#### 11e. `CountryBreakdown.svelte`
- Read `reportsStore.aggregations.byCountry`
- Sorted table: rank, country code, transaction count, gross revenue, % of total
- Show top 10 by default with "Show all" toggle
- Country codes displayed as-is (2-letter codes)

#### 11f. `ProductBreakdown.svelte`
- Read `reportsStore.aggregations.byProduct`
- Table: product title, type badge (one-time/subscription), SKU, revenue, count
- Sorted by revenue descending
- Only shown when there are multiple products/SKUs

#### 11g. `TransactionTable.svelte`
- Read `reportsStore.paginatedTransactions`
- Columns: date, type, buyer amount + currency, merchant amount + currency, country, device
- Column headers clickable for sorting (update `reportsStore.transactionSort`)
- Filter tabs: All | Charges | Refunds (update `reportsStore.transactionFilter`)
- Pagination controls: prev/next page, page N of M
- "Export CSV" button: generate CSV from filtered transactions, trigger download via Blob URL

### Step 12: Create FinancialReports Screen — `src/renderer/src/screens/FinancialReports.svelte`

**New file.** Layout:

```svelte
<script lang="ts">
  import { getRoute } from '../router.svelte'
  import { reportsStore } from '../stores/reports.svelte'
  import { settingsStore } from '../stores/settings.svelte'
  import CsvImporter from '../components/reports/CsvImporter.svelte'
  import MonthSelector from '../components/reports/MonthSelector.svelte'
  import RevenueSummary from '../components/reports/RevenueSummary.svelte'
  import RevenueChart from '../components/reports/RevenueChart.svelte'
  import CountryBreakdown from '../components/reports/CountryBreakdown.svelte'
  import ProductBreakdown from '../components/reports/ProductBreakdown.svelte'
  import TransactionTable from '../components/reports/TransactionTable.svelte'

  const route = $derived(getRoute())
  const appPath = $derived(route.screen === 'reports' ? route.appPath : '')

  $effect(() => {
    if (appPath) {
      reportsStore.load(appPath)
    }
  })
</script>

<main class="reports-page">
  <!-- Top bar: CsvImporter (collapsible) + MonthSelector -->
  <div class="reports-toolbar">
    <CsvImporter />
    <MonthSelector />
  </div>

  {#if reportsStore.loading}
    <p class="status">Loading...</p>
  {:else if reportsStore.error}
    <div class="error-banner">{reportsStore.error}</div>
  {:else if reportsStore.aggregations}
    <!-- App/All toggle -->
    <div class="view-toggle">...</div>

    <!-- Summary cards -->
    <RevenueSummary />

    <!-- Chart -->
    <RevenueChart />

    <!-- Two-column: Country + Product breakdowns -->
    <div class="breakdown-row">
      <CountryBreakdown />
      <ProductBreakdown />
    </div>

    <!-- Full-width transaction table -->
    <TransactionTable />
  {:else}
    <div class="empty-state">
      <p>No report data yet. Import a CSV from Google Play Console to get started.</p>
    </div>
  {/if}
</main>
```

Styling: scrollable page, max-width ~1200px (wider than dashboard to fit charts/tables), sections with spacing.

### Step 13: Wire Screen into App.svelte

**Modify** `src/renderer/src/App.svelte`:
- Add import: `import FinancialReports from './screens/FinancialReports.svelte'`
- Add import: `import { reportsStore } from './stores/reports.svelte'`
- Replace placeholder (lines 130-133):
  ```svelte
  {:else if route.screen === 'reports'}
    <FinancialReports />
  ```
- Add `case 'reports': reportsStore.reload(); break;` to `refreshForRoute()` switch

### Step 14: Add Navigation from AppDashboard

**Modify** `src/renderer/src/screens/AppDashboard.svelte`:
- Add import: `import { goToReports } from '../router.svelte'` (line 3, alongside goToScreenshots)
- Add button after line 124 (after Screenshot Manager button, before Delete App):
  ```svelte
  <button class="btn btn-secondary" onclick={() => goToReports(appPath)}>
    Financial Reports
  </button>
  ```

---

## Files Summary

### New Files (8):
| File | Purpose |
|------|---------|
| `src/main/services/reports.ts` | CSV parser + aggregation logic |
| `src/main/ipc/reports-handlers.ts` | 5 IPC channel handlers |
| `src/renderer/src/stores/reports.svelte.ts` | Svelte 5 runes store |
| `src/renderer/src/screens/FinancialReports.svelte` | Main reports screen |
| `src/renderer/src/components/reports/CsvImporter.svelte` | CSV import UI |
| `src/renderer/src/components/reports/MonthSelector.svelte` | Month range picker |
| `src/renderer/src/components/reports/RevenueSummary.svelte` | Summary metric cards |
| `src/renderer/src/components/reports/RevenueChart.svelte` | Chart.js bar/line chart |
| `src/renderer/src/components/reports/CountryBreakdown.svelte` | Country revenue table |
| `src/renderer/src/components/reports/ProductBreakdown.svelte` | Product revenue table |
| `src/renderer/src/components/reports/TransactionTable.svelte` | Paginated transaction list |

### Modified Files (8):
| File | Change |
|------|--------|
| `src/shared/types/models.ts` | Add 8 new type interfaces |
| `src/shared/types/ipc-channels.ts` | Add 5 channel constants + union members |
| `src/shared/types/ipc-payloads.ts` | Add 5 request/response type pairs |
| `src/main/index.ts` | Import + call `registerReportsHandlers()` |
| `src/preload/index.ts` | Import channels + add 5 API methods |
| `src/renderer/src/lib/ipc.ts` | Add 5 typed wrapper methods |
| `src/renderer/src/App.svelte` | Import screen + replace placeholder + add watcher case |
| `src/renderer/src/screens/AppDashboard.svelte` | Import `goToReports` + add nav button |
| `package.json` | Add `chart.js` dependency |

---

## Edge Cases & Design Notes

- **Duplicate CSV import**: If a CSV with the same month is re-imported, overwrite the existing parsed JSON and update the index entry (don't create duplicates)
- **Multi-month CSV**: A single CSV may contain transactions spanning multiple months. Parse all months, create separate parsed JSONs for each
- **Empty CSV / wrong format**: Validate that expected columns exist in header row. Throw descriptive error if missing
- **Currency**: All aggregations use `merchantAmount` (seller's payout currency). Display `merchantCurrency` from first transaction. Don't mix currencies — if multiple merchant currencies exist, show a warning
- **App filter**: When viewing from an app dashboard, filter by `productId === packageName`. "All Apps" mode removes the filter
- **No data state**: Show clear empty state with instructions to import CSV
- **Large CSVs**: Parse in-memory (Google Play CSVs are typically < 10MB). No streaming needed.

---

## Verification

After implementation, verify by:
1. `npm run dev` — app launches without errors
2. `npx svelte-check` — no type errors in renderer
3. `npx tsc --noEmit -p tsconfig.node.json` — no type errors in main/preload
4. Manual testing flow:
   - Dashboard -> "Financial Reports" button -> navigates to reports screen
   - Import a Google Play earnings CSV -> summary shows parsed data
   - RevenueSummary cards display gross, fees, refunds, net, count
   - RevenueChart renders month-over-month bars
   - Country and Product breakdown tables populate
   - Transaction table shows individual rows, filter/sort/paginate work
   - Switch month range -> all views update
   - Switch to "All Apps" -> shows combined data
   - Delete an imported month -> data refreshes
   - Breadcrumb navigation works (Home > App Name > Financial Reports)
