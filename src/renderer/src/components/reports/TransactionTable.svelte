<script lang="ts">
  import { reportsStore } from '../../stores/reports.svelte'

  const currency = $derived(reportsStore.aggregations?.monthly[0]?.merchantCurrency ?? '')

  function formatCurrency(amount: number, cur: string): string {
    if (!cur) return amount.toFixed(2)
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(amount)
    } catch {
      return `${cur} ${amount.toFixed(2)}`
    }
  }

  function formatDate(dateStr: string): string {
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    } catch {
      return dateStr
    }
  }

  function formatType(type: string): string {
    switch (type) {
      case 'charge': return 'Charge'
      case 'google-fee': return 'Fee'
      case 'charge-refund': return 'Refund'
      case 'google-fee-refund': return 'Fee Refund'
      case 'tax': return 'Tax'
      default: return type
    }
  }

  function handleSort(column: string): void {
    reportsStore.setTransactionSort(column)
  }

  function sortIcon(column: string): string {
    if (reportsStore.transactionSortColumn !== column) return ''
    return reportsStore.transactionSortDir === 'asc' ? ' \u2191' : ' \u2193'
  }

  function handleExportCsv(): void {
    const txs = reportsStore.filteredTransactions
    if (txs.length === 0) return

    const headers = ['Date', 'Type', 'Buyer Amount', 'Buyer Currency', 'Merchant Amount', 'Merchant Currency', 'Country', 'Device', 'Product']
    const rows = txs.map((tx) => [
      tx.date,
      tx.type,
      String(tx.buyerAmount),
      tx.buyerCurrency,
      String(tx.merchantAmount),
      tx.merchantCurrency,
      tx.buyerCountry,
      tx.hardware,
      tx.productTitle
    ])

    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'transactions.csv'
    a.click()
    URL.revokeObjectURL(url)
  }
</script>

<div class="transaction-table">
  <div class="table-header">
    <h3>Transactions</h3>
    <div class="table-controls">
      <div class="filter-tabs">
        <button
          class="tab"
          class:active={reportsStore.transactionFilter === 'all'}
          onclick={() => reportsStore.setTransactionFilter('all')}
        >All</button>
        <button
          class="tab"
          class:active={reportsStore.transactionFilter === 'charges'}
          onclick={() => reportsStore.setTransactionFilter('charges')}
        >Charges</button>
        <button
          class="tab"
          class:active={reportsStore.transactionFilter === 'refunds'}
          onclick={() => reportsStore.setTransactionFilter('refunds')}
        >Refunds</button>
      </div>
      <button class="export-btn" onclick={handleExportCsv}>Export CSV</button>
    </div>
  </div>

  {#if reportsStore.filteredTransactions.length === 0}
    <p class="empty">No transactions match the current filter.</p>
  {:else}
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th class="sortable" onclick={() => handleSort('date')}>Date{sortIcon('date')}</th>
            <th class="sortable" onclick={() => handleSort('type')}>Type{sortIcon('type')}</th>
            <th class="sortable num" onclick={() => handleSort('buyerAmount')}>Buyer Amt{sortIcon('buyerAmount')}</th>
            <th class="sortable num" onclick={() => handleSort('merchantAmount')}>Merchant Amt{sortIcon('merchantAmount')}</th>
            <th class="sortable" onclick={() => handleSort('buyerCountry')}>Country{sortIcon('buyerCountry')}</th>
            <th>Device</th>
          </tr>
        </thead>
        <tbody>
          {#each reportsStore.paginatedTransactions as tx (tx.id + tx.type)}
            <tr>
              <td>{formatDate(tx.date)}</td>
              <td>
                <span class="type-label" class:refund={tx.type.includes('refund')} class:fee={tx.type.includes('fee')}>
                  {formatType(tx.type)}
                </span>
              </td>
              <td class="num">{formatCurrency(tx.buyerAmount, tx.buyerCurrency)}</td>
              <td class="num">{formatCurrency(tx.merchantAmount, tx.merchantCurrency)}</td>
              <td>{tx.buyerCountry}</td>
              <td class="device">{tx.hardware}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <div class="pagination">
      <button
        class="page-btn"
        disabled={reportsStore.transactionPage === 0}
        onclick={() => (reportsStore.transactionPage = Math.max(0, reportsStore.transactionPage - 1))}
      >Prev</button>
      <span class="page-info">
        Page {reportsStore.transactionPage + 1} of {reportsStore.totalPages}
        ({reportsStore.filteredTransactions.length} rows)
      </span>
      <button
        class="page-btn"
        disabled={reportsStore.transactionPage >= reportsStore.totalPages - 1}
        onclick={() => (reportsStore.transactionPage = Math.min(reportsStore.totalPages - 1, reportsStore.transactionPage + 1))}
      >Next</button>
    </div>
  {/if}
</div>

<style>
  .transaction-table {
    background: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    overflow: hidden;
  }

  .table-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    flex-wrap: wrap;
    gap: 8px;
  }

  h3 {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0;
  }

  .table-controls {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .filter-tabs {
    display: flex;
    gap: 0;
    border: 1px solid #ddd;
    border-radius: 6px;
    overflow: hidden;
  }

  .tab {
    padding: 4px 12px;
    font-size: 0.75rem;
    font-family: inherit;
    background: #fff;
    border: none;
    border-right: 1px solid #ddd;
    cursor: pointer;
    color: #555;
  }

  .tab:last-child {
    border-right: none;
  }

  .tab.active {
    background: #0066cc;
    color: #fff;
  }

  .export-btn {
    padding: 4px 12px;
    font-size: 0.75rem;
    font-family: inherit;
    background: #f0f0f0;
    border: 1px solid #ddd;
    border-radius: 6px;
    cursor: pointer;
    color: #333;
  }

  .export-btn:hover {
    background: #e0e0e0;
  }

  .table-scroll {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
  }

  thead th {
    text-align: left;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #888;
    padding: 8px 12px;
    border-bottom: 1px solid #e0e0e0;
    white-space: nowrap;
  }

  .sortable {
    cursor: pointer;
    user-select: none;
  }

  .sortable:hover {
    color: #0066cc;
  }

  tbody td {
    padding: 8px 12px;
    color: #333;
    border-bottom: 1px solid #f5f5f5;
    white-space: nowrap;
  }

  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .type-label {
    font-size: 0.75rem;
    font-weight: 500;
  }

  .type-label.refund {
    color: #e65100;
  }

  .type-label.fee {
    color: #d32f2f;
  }

  .device {
    color: #888;
    font-size: 0.75rem;
  }

  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 12px 16px;
    border-top: 1px solid #f0f0f0;
  }

  .page-btn {
    padding: 4px 12px;
    font-size: 0.75rem;
    font-family: inherit;
    background: #f0f0f0;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    color: #333;
  }

  .page-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .page-btn:not(:disabled):hover {
    background: #e0e0e0;
  }

  .page-info {
    font-size: 0.75rem;
    color: #888;
  }

  .empty {
    padding: 24px 16px;
    text-align: center;
    font-size: 0.8125rem;
    color: #888;
  }
</style>
