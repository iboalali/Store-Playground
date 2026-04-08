<script lang="ts">
  import { reportsStore } from '../../stores/reports.svelte'

  const products = $derived(reportsStore.aggregations?.byProduct ?? [])
  const currency = $derived(reportsStore.aggregations?.monthly[0]?.merchantCurrency ?? '')

  function formatCurrency(amount: number): string {
    if (!currency) return amount.toFixed(2)
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
    } catch {
      return `${currency} ${amount.toFixed(2)}`
    }
  }
</script>

{#if products.length > 0}
  <div class="product-breakdown">
    <h3>Revenue by Product</h3>
    <table>
      <thead>
        <tr>
          <th>Product</th>
          <th>Type</th>
          <th class="num">Transactions</th>
          <th class="num">Revenue</th>
        </tr>
      </thead>
      <tbody>
        {#each products as product (product.productId + ':' + (product.skuId ?? ''))}
          <tr>
            <td>
              <div class="product-name">{product.productTitle}</div>
              {#if product.skuId}
                <div class="sku">SKU: {product.skuId}</div>
              {/if}
            </td>
            <td>
              <span class="type-badge" class:subscription={product.productType === 'subscription'}>
                {product.productType === 'subscription' ? 'Sub' : 'One-time'}
              </span>
            </td>
            <td class="num">{product.transactionCount}</td>
            <td class="num">{formatCurrency(product.grossRevenue)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<style>
  .product-breakdown {
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
    padding: 8px;
    color: #333;
    border-bottom: 1px solid #f5f5f5;
    vertical-align: top;
  }

  .product-name {
    font-weight: 500;
  }

  .sku {
    font-size: 0.6875rem;
    color: #888;
    font-family: 'SF Mono', 'Fira Code', monospace;
    margin-top: 2px;
  }

  .type-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.6875rem;
    font-weight: 500;
    background: #f0f0f0;
    color: #555;
  }

  .type-badge.subscription {
    background: #e8f5e9;
    color: #2e7d32;
  }

  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
</style>
