import { readFile, writeFile, mkdir, readdir, unlink, copyFile } from 'node:fs/promises'
import { join, basename } from 'node:path'
import type {
  Transaction,
  ReportsIndex,
  ImportedFile,
  ImportSummary,
  AggregationResult,
  MonthlyAggregation,
  CountryAggregation,
  ProductAggregation
} from '$shared/types/models'

// --- CSV Parsing ---

const MONTH_NAMES: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
}

const TRANSACTION_TYPE_MAP: Record<string, Transaction['type']> = {
  'Charge': 'charge',
  'Google fee': 'google-fee',
  'Charge refund': 'charge-refund',
  'Google fee refund': 'google-fee-refund',
  'Tax': 'tax'
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let insideQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (insideQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          insideQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        insideQuotes = true
      } else if (ch === ',') {
        fields.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
  }
  fields.push(current.trim())
  return fields
}

function parseTransactionDate(dateStr: string, timeStr: string): string {
  // dateStr: "Dec 1, 2024"
  // timeStr: "6:23:05 PM PST"
  const dateMatch = dateStr.match(/^(\w{3})\s+(\d{1,2}),\s+(\d{4})$/)
  if (!dateMatch) return new Date().toISOString()

  const month = MONTH_NAMES[dateMatch[1]] ?? '01'
  const day = dateMatch[2].padStart(2, '0')
  const year = dateMatch[3]

  // Parse time
  const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2}):(\d{2})\s+(AM|PM)\s+(.+)$/)
  if (!timeMatch) return `${year}-${month}-${day}T00:00:00Z`

  let hours = parseInt(timeMatch[1], 10)
  const minutes = timeMatch[2]
  const seconds = timeMatch[3]
  const ampm = timeMatch[4]
  const tz = timeMatch[5]

  if (ampm === 'PM' && hours !== 12) hours += 12
  if (ampm === 'AM' && hours === 12) hours = 0

  // Map common timezone abbreviations to offsets
  const tzOffsets: Record<string, string> = {
    PST: '-08:00', PDT: '-07:00', EST: '-05:00', EDT: '-04:00',
    CST: '-06:00', CDT: '-05:00', MST: '-07:00', MDT: '-06:00',
    UTC: '+00:00', GMT: '+00:00', CET: '+01:00', CEST: '+02:00'
  }
  const offset = tzOffsets[tz] ?? '+00:00'

  return `${year}-${month}-${day}T${String(hours).padStart(2, '0')}:${minutes}:${seconds}${offset}`
}

function parseAmount(value: string): number {
  if (!value) return 0
  const cleaned = value.replace(/,/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

export async function parseEarningsCsv(csvPath: string): Promise<Map<string, Transaction[]>> {
  const raw = await readFile(csvPath, 'utf-8')
  const lines = raw.split('\n').filter((l) => l.trim().length > 0)

  if (lines.length < 2) {
    throw new Error('CSV file is empty or has no data rows')
  }

  const headers = parseCsvLine(lines[0])
  const colIndex = (name: string): number => {
    const idx = headers.indexOf(name)
    if (idx === -1) throw new Error(`Missing required CSV column: "${name}"`)
    return idx
  }

  // Validate required columns
  const iDesc = colIndex('Description')
  const iDate = colIndex('Transaction Date')
  const iTime = colIndex('Transaction Time')
  const iType = colIndex('Transaction Type')
  const iRefund = headers.indexOf('Refund Type')
  const iProdTitle = colIndex('Product Title')
  const iProdId = colIndex('Product id')
  const iProdType = colIndex('Product Type')
  const iSku = headers.indexOf('Sku Id')
  const iHardware = headers.indexOf('Hardware')
  const iBuyerCountry = colIndex('Buyer Country')
  const iBuyerState = headers.indexOf('Buyer State')
  const iBuyerPostal = headers.indexOf('Buyer Postal Code')
  const iBuyerCurrency = colIndex('Buyer Currency')
  const iBuyerAmount = colIndex('Amount (Buyer Currency)')
  const iConvRate = headers.indexOf('Currency Conversion Rate')
  const iMerchCurrency = colIndex('Merchant Currency')
  const iMerchAmount = colIndex('Amount (Merchant Currency)')
  const iBasePlan = headers.indexOf('Base Plan ID')
  const iOffer = headers.indexOf('Offer ID')
  const iFirstMil = headers.indexOf('First USD 1M Eligible')
  const iServiceFee = headers.indexOf('Service Fee %')

  const monthMap = new Map<string, Transaction[]>()

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i])
    if (fields.length < headers.length) continue

    const txType = TRANSACTION_TYPE_MAP[fields[iType]]
    if (!txType) continue

    const dateStr = parseTransactionDate(fields[iDate], fields[iTime])
    const prodTypeRaw = fields[iProdType]
    const productType: Transaction['productType'] = prodTypeRaw === '1' ? 'subscription' : 'one-time'

    const serviceFeeStr = iServiceFee >= 0 ? fields[iServiceFee] : ''
    const serviceFeePercent = serviceFeeStr ? parseFloat(serviceFeeStr) : null

    const firstMilStr = iFirstMil >= 0 ? fields[iFirstMil] : ''

    const tx: Transaction = {
      id: fields[iDesc],
      date: dateStr,
      type: txType,
      refundType: iRefund >= 0 && fields[iRefund] ? fields[iRefund] : null,
      productId: fields[iProdId],
      productTitle: fields[iProdTitle],
      productType,
      skuId: iSku >= 0 && fields[iSku] ? fields[iSku] : null,
      hardware: iHardware >= 0 ? fields[iHardware] : '',
      buyerCountry: fields[iBuyerCountry],
      buyerState: iBuyerState >= 0 ? fields[iBuyerState] : '',
      buyerPostalCode: iBuyerPostal >= 0 ? fields[iBuyerPostal] : '',
      buyerCurrency: fields[iBuyerCurrency],
      buyerAmount: parseAmount(fields[iBuyerAmount]),
      conversionRate: iConvRate >= 0 ? parseAmount(fields[iConvRate]) : 1,
      merchantCurrency: fields[iMerchCurrency],
      merchantAmount: parseAmount(fields[iMerchAmount]),
      basePlanId: iBasePlan >= 0 && fields[iBasePlan] ? fields[iBasePlan] : null,
      offerId: iOffer >= 0 && fields[iOffer] ? fields[iOffer] : null,
      serviceFeePercent: isNaN(serviceFeePercent!) ? null : serviceFeePercent,
      firstMillionEligible: firstMilStr === 'Yes'
    }

    // Extract month key (YYYY-MM) from parsed date
    const monthKey = dateStr.slice(0, 7)
    const existing = monthMap.get(monthKey) ?? []
    existing.push(tx)
    monthMap.set(monthKey, existing)
  }

  return monthMap
}

// --- Index management ---

const REPORTS_DIR = 'reports'
const CSV_DIR = 'csv'
const PARSED_DIR = 'parsed'
const INDEX_FILE = 'reports_index.json'

function reportsPath(workspacePath: string, ...segments: string[]): string {
  return join(workspacePath, REPORTS_DIR, ...segments)
}

async function ensureDirs(workspacePath: string): Promise<void> {
  await mkdir(reportsPath(workspacePath), { recursive: true })
  await mkdir(reportsPath(workspacePath, CSV_DIR), { recursive: true })
  await mkdir(reportsPath(workspacePath, PARSED_DIR), { recursive: true })
}

function defaultIndex(): ReportsIndex {
  return { importedFiles: [], dateRange: { earliest: '', latest: '' } }
}

function recalcDateRange(files: ImportedFile[]): { earliest: string; latest: string } {
  if (files.length === 0) return { earliest: '', latest: '' }
  const months = files.map((f) => f.monthKey).sort()
  return { earliest: months[0], latest: months[months.length - 1] }
}

export async function getIndex(workspacePath: string): Promise<ReportsIndex> {
  try {
    const raw = await readFile(reportsPath(workspacePath, INDEX_FILE), 'utf-8')
    return JSON.parse(raw) as ReportsIndex
  } catch {
    return defaultIndex()
  }
}

export async function getMonth(workspacePath: string, monthKey: string): Promise<Transaction[]> {
  const filePath = reportsPath(workspacePath, PARSED_DIR, `${monthKey}.json`)
  const raw = await readFile(filePath, 'utf-8')
  const parsed = JSON.parse(raw) as { month: string; transactions: Transaction[] }
  return parsed.transactions
}

export async function importCsv(csvPath: string, workspacePath: string): Promise<ImportSummary> {
  await ensureDirs(workspacePath)

  const monthMap = await parseEarningsCsv(csvPath)

  if (monthMap.size === 0) {
    throw new Error('No valid transactions found in CSV')
  }

  const filename = basename(csvPath)

  // Write parsed JSON for each month
  let totalRows = 0
  const allApps = new Set<string>()
  const monthKeys: string[] = []

  for (const [monthKey, transactions] of monthMap) {
    monthKeys.push(monthKey)
    totalRows += transactions.length
    for (const tx of transactions) {
      if (tx.productId) allApps.add(tx.productId)
    }

    const parsedPath = reportsPath(workspacePath, PARSED_DIR, `${monthKey}.json`)
    await writeFile(parsedPath, JSON.stringify({ month: monthKey, transactions }, null, 2), 'utf-8')
  }

  // Copy raw CSV
  const csvDest = reportsPath(workspacePath, CSV_DIR, filename)
  await copyFile(csvPath, csvDest)

  // Update index
  const index = await getIndex(workspacePath)
  const apps = Array.from(allApps)

  // Add/replace entries for each month found
  for (const monthKey of monthKeys) {
    const txCount = monthMap.get(monthKey)!.length
    const existingIdx = index.importedFiles.findIndex((f) => f.monthKey === monthKey)
    const entry: ImportedFile = {
      filename,
      importedAt: new Date().toISOString(),
      monthKey,
      rowCount: txCount,
      apps
    }
    if (existingIdx >= 0) {
      index.importedFiles[existingIdx] = entry
    } else {
      index.importedFiles.push(entry)
    }
  }

  index.dateRange = recalcDateRange(index.importedFiles)
  await writeFile(reportsPath(workspacePath, INDEX_FILE), JSON.stringify(index, null, 2), 'utf-8')

  // Return summary for the primary month (first chronologically)
  monthKeys.sort()
  return {
    monthKey: monthKeys.length === 1 ? monthKeys[0] : `${monthKeys[0]} to ${monthKeys[monthKeys.length - 1]}`,
    rowCount: totalRows,
    apps,
    filename
  }
}

export async function deleteMonth(workspacePath: string, monthKey: string): Promise<void> {
  // Delete parsed JSON
  const parsedPath = reportsPath(workspacePath, PARSED_DIR, `${monthKey}.json`)
  try {
    await unlink(parsedPath)
  } catch {
    // File may not exist
  }

  // Update index — remove entries for this month
  const index = await getIndex(workspacePath)
  const removedEntry = index.importedFiles.find((f) => f.monthKey === monthKey)
  index.importedFiles = index.importedFiles.filter((f) => f.monthKey !== monthKey)

  // Try to remove the associated raw CSV if no other months reference it
  if (removedEntry) {
    const otherFileRefs = index.importedFiles.some((f) => f.filename === removedEntry.filename)
    if (!otherFileRefs) {
      try {
        await unlink(reportsPath(workspacePath, CSV_DIR, removedEntry.filename))
      } catch {
        // File may not exist
      }
    }
  }

  index.dateRange = recalcDateRange(index.importedFiles)
  await writeFile(reportsPath(workspacePath, INDEX_FILE), JSON.stringify(index, null, 2), 'utf-8')
}

// --- Aggregation ---

function aggregateByMonth(transactions: Transaction[]): MonthlyAggregation[] {
  const monthMap = new Map<string, {
    gross: number; fees: number; refunds: number; feeRefunds: number
    chargeCount: number; refundCount: number; currency: string
  }>()

  for (const tx of transactions) {
    const monthKey = tx.date.slice(0, 7)
    const entry = monthMap.get(monthKey) ?? {
      gross: 0, fees: 0, refunds: 0, feeRefunds: 0,
      chargeCount: 0, refundCount: 0, currency: tx.merchantCurrency
    }

    switch (tx.type) {
      case 'charge':
        entry.gross += tx.merchantAmount
        entry.chargeCount++
        break
      case 'google-fee':
        entry.fees += tx.merchantAmount
        break
      case 'charge-refund':
        entry.refunds += tx.merchantAmount
        entry.refundCount++
        break
      case 'google-fee-refund':
        entry.feeRefunds += tx.merchantAmount
        break
    }

    monthMap.set(monthKey, entry)
  }

  const result: MonthlyAggregation[] = []
  for (const [month, data] of monthMap) {
    const netRevenue = data.gross + data.fees + data.refunds + data.feeRefunds
    result.push({
      month,
      grossRevenue: data.gross,
      googleFees: data.fees,
      refunds: data.refunds,
      netRevenue,
      totalTransactions: data.chargeCount,
      refundCount: data.refundCount,
      refundRate: data.chargeCount > 0 ? data.refundCount / data.chargeCount : 0,
      merchantCurrency: data.currency
    })
  }

  return result.sort((a, b) => a.month.localeCompare(b.month))
}

function aggregateByCountry(transactions: Transaction[]): CountryAggregation[] {
  const countryMap = new Map<string, { revenue: number; count: number }>()
  let totalRevenue = 0

  for (const tx of transactions) {
    if (tx.type !== 'charge') continue
    const entry = countryMap.get(tx.buyerCountry) ?? { revenue: 0, count: 0 }
    entry.revenue += tx.merchantAmount
    entry.count++
    countryMap.set(tx.buyerCountry, entry)
    totalRevenue += tx.merchantAmount
  }

  const result: CountryAggregation[] = []
  for (const [country, data] of countryMap) {
    result.push({
      country,
      grossRevenue: data.revenue,
      transactionCount: data.count,
      percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0
    })
  }

  return result.sort((a, b) => b.grossRevenue - a.grossRevenue)
}

function aggregateByProduct(transactions: Transaction[]): ProductAggregation[] {
  const productMap = new Map<string, {
    title: string; type: Transaction['productType']; skuId: string | null
    revenue: number; count: number
  }>()

  for (const tx of transactions) {
    if (tx.type !== 'charge') continue
    const key = tx.skuId ? `${tx.productId}:${tx.skuId}` : tx.productId
    const entry = productMap.get(key) ?? {
      title: tx.productTitle, type: tx.productType,
      skuId: tx.skuId, revenue: 0, count: 0
    }
    entry.revenue += tx.merchantAmount
    entry.count++
    productMap.set(key, entry)
  }

  const result: ProductAggregation[] = []
  for (const [key, data] of productMap) {
    const productId = key.includes(':') ? key.split(':')[0] : key
    result.push({
      productId,
      productTitle: data.title,
      productType: data.type,
      skuId: data.skuId,
      grossRevenue: data.revenue,
      transactionCount: data.count
    })
  }

  return result.sort((a, b) => b.grossRevenue - a.grossRevenue)
}

export async function getAggregation(
  workspacePath: string,
  monthKeys: string[],
  appFilter?: string
): Promise<AggregationResult> {
  let allTransactions: Transaction[] = []

  for (const monthKey of monthKeys) {
    try {
      const transactions = await getMonth(workspacePath, monthKey)
      allTransactions = allTransactions.concat(transactions)
    } catch {
      // Month may not exist, skip
    }
  }

  // Filter by app if specified
  if (appFilter) {
    allTransactions = allTransactions.filter((tx) => tx.productId === appFilter)
  }

  return {
    monthly: aggregateByMonth(allTransactions),
    byCountry: aggregateByCountry(allTransactions),
    byProduct: aggregateByProduct(allTransactions)
  }
}
