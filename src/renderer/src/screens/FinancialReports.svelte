<script lang="ts">
  import { getRoute } from '../router.svelte'
  import { reportsStore } from '../stores/reports.svelte'
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
  <!-- Toolbar: Import + Month range -->
  <div class="reports-toolbar">
    <CsvImporter />
    <div class="toolbar-row">
      <MonthSelector />
      <div class="view-toggle">
        <button
          class="toggle-btn"
          class:active={reportsStore.viewMode === 'app'}
          onclick={() => reportsStore.setViewMode('app')}
        >This App</button>
        <button
          class="toggle-btn"
          class:active={reportsStore.viewMode === 'all'}
          onclick={() => reportsStore.setViewMode('all')}
        >All Apps</button>
      </div>
    </div>
  </div>

  {#if reportsStore.loading}
    <p class="status">Loading reports...</p>
  {:else if reportsStore.error}
    <div class="error-banner">{reportsStore.error}</div>
  {:else if reportsStore.aggregations && reportsStore.aggregations.monthly.length > 0}
    <div class="reports-content">
      <RevenueSummary />
      <RevenueChart />
      <div class="breakdown-row">
        <CountryBreakdown />
        <ProductBreakdown />
      </div>
      <TransactionTable />
    </div>
  {:else if reportsStore.index && reportsStore.index.importedFiles.length > 0}
    <div class="empty-state">
      <p>No transaction data found for the selected app and date range.</p>
      <p class="hint">Try switching to "All Apps" or selecting a different date range.</p>
    </div>
  {:else}
    <div class="empty-state">
      <p>No report data yet.</p>
      <p class="hint">Import an earnings CSV from Google Play Console to get started.</p>
    </div>
  {/if}
</main>

<style>
  .reports-page {
    padding: 24px;
    height: calc(100vh - 48px);
    overflow-y: auto;
    max-width: 1200px;
    margin: 0 auto;
  }

  .reports-toolbar {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 20px;
  }

  .toolbar-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .view-toggle {
    display: flex;
    gap: 0;
    border: 1px solid #ddd;
    border-radius: 6px;
    overflow: hidden;
  }

  .toggle-btn {
    padding: 6px 14px;
    font-size: 0.8125rem;
    font-family: inherit;
    background: #fff;
    border: none;
    border-right: 1px solid #ddd;
    cursor: pointer;
    color: #555;
  }

  .toggle-btn:last-child {
    border-right: none;
  }

  .toggle-btn.active {
    background: #0066cc;
    color: #fff;
  }

  .reports-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .breakdown-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  @media (max-width: 800px) {
    .breakdown-row {
      grid-template-columns: 1fr;
    }
  }

  .status {
    color: #888;
    font-size: 0.875rem;
    padding: 24px 0;
  }

  .error-banner {
    background: #fef2f2;
    color: #d32f2f;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 0.8125rem;
  }

  .empty-state {
    text-align: center;
    padding: 48px 24px;
    color: #888;
  }

  .empty-state p {
    font-size: 0.9375rem;
    margin-bottom: 4px;
  }

  .hint {
    font-size: 0.8125rem;
    color: #aaa;
  }
</style>
