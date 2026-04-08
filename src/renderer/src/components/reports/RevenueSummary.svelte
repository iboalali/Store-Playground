<script lang="ts">
  import { reportsStore } from '../../stores/reports.svelte'

  function formatCurrency(amount: number, currency: string): string {
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
    } catch {
      return `${currency} ${amount.toFixed(2)}`
    }
  }

  function formatPercent(value: number): string {
    return `${(value * 100).toFixed(1)}%`
  }

  const totals = $derived.by(() => {
    const agg = reportsStore.aggregations
    if (!agg || agg.monthly.length === 0) return null

    const currency = agg.monthly[0].merchantCurrency
    let gross = 0
    let fees = 0
    let refunds = 0
    let net = 0
    let txCount = 0
    let refundCount = 0

    for (const m of agg.monthly) {
      gross += m.grossRevenue
      fees += m.googleFees
      refunds += m.refunds
      net += m.netRevenue
      txCount += m.totalTransactions
      refundCount += m.refundCount
    }

    const feePercent = gross !== 0 ? Math.abs(fees / gross) : 0
    const refundRate = txCount > 0 ? refundCount / txCount : 0

    return { gross, fees, refunds, net, txCount, refundCount, feePercent, refundRate, currency }
  })
</script>

{#if totals}
  <div class="summary-row">
    <div class="summary-card">
      <span class="card-label">Gross Revenue</span>
      <span class="card-value">{formatCurrency(totals.gross, totals.currency)}</span>
    </div>

    <div class="summary-card">
      <span class="card-label">Google Fees</span>
      <span class="card-value negative">{formatCurrency(totals.fees, totals.currency)}</span>
      <span class="card-sub">{formatPercent(totals.feePercent)} of gross</span>
    </div>

    <div class="summary-card">
      <span class="card-label">Refunds</span>
      <span class="card-value negative">{formatCurrency(totals.refunds, totals.currency)}</span>
      <span class="card-sub">{formatPercent(totals.refundRate)} refund rate</span>
    </div>

    <div class="summary-card highlight">
      <span class="card-label">Net Revenue</span>
      <span class="card-value">{formatCurrency(totals.net, totals.currency)}</span>
    </div>

    <div class="summary-card">
      <span class="card-label">Transactions</span>
      <span class="card-value">{totals.txCount.toLocaleString()}</span>
      {#if totals.refundCount > 0}
        <span class="card-sub">{totals.refundCount} refund{totals.refundCount !== 1 ? 's' : ''}</span>
      {/if}
    </div>
  </div>
{/if}

<style>
  .summary-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
  }

  .summary-card {
    background: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .summary-card.highlight {
    border-color: #0066cc;
    background: #f0f7ff;
  }

  .card-label {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #888;
  }

  .card-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: #1a1a1a;
  }

  .card-value.negative {
    color: #d32f2f;
  }

  .card-sub {
    font-size: 0.6875rem;
    color: #999;
  }
</style>
