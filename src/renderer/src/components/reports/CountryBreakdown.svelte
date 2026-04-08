<script lang="ts">
  import { reportsStore } from '../../stores/reports.svelte'

  let showAll = $state(false)

  const countries = $derived(reportsStore.aggregations?.byCountry ?? [])
  const currency = $derived(reportsStore.aggregations?.monthly[0]?.merchantCurrency ?? '')
  const displayed = $derived(showAll ? countries : countries.slice(0, 10))

  function formatCurrency(amount: number): string {
    if (!currency) return amount.toFixed(2)
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
    } catch {
      return `${currency} ${amount.toFixed(2)}`
    }
  }
</script>

{#if countries.length > 0}
  <div class="country-breakdown">
    <h3>Revenue by Country</h3>
    <table>
      <thead>
        <tr>
          <th class="rank">#</th>
          <th>Country</th>
          <th class="num">Transactions</th>
          <th class="num">Revenue</th>
          <th class="num">%</th>
        </tr>
      </thead>
      <tbody>
        {#each displayed as country, i (country.country)}
          <tr>
            <td class="rank">{i + 1}</td>
            <td class="country-code">{country.country}</td>
            <td class="num">{country.transactionCount}</td>
            <td class="num">{formatCurrency(country.grossRevenue)}</td>
            <td class="num">{country.percentage.toFixed(1)}%</td>
          </tr>
        {/each}
      </tbody>
    </table>
    {#if countries.length > 10}
      <button class="show-toggle" onclick={() => (showAll = !showAll)}>
        {showAll ? 'Show top 10' : `Show all ${countries.length} countries`}
      </button>
    {/if}
  </div>
{/if}

<style>
  .country-breakdown {
    background: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 16px;
  }

  h3 {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0 0 12px;
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
    padding: 4px 8px 8px;
    border-bottom: 1px solid #e0e0e0;
  }

  tbody td {
    padding: 6px 8px;
    color: #333;
    border-bottom: 1px solid #f5f5f5;
  }

  .rank {
    width: 30px;
    color: #aaa;
  }

  .country-code {
    font-weight: 500;
  }

  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .show-toggle {
    display: block;
    margin: 8px auto 0;
    background: none;
    border: none;
    color: #0066cc;
    font-size: 0.75rem;
    cursor: pointer;
    font-family: inherit;
  }

  .show-toggle:hover {
    text-decoration: underline;
  }
</style>
