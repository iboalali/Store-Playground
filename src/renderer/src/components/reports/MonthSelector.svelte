<script lang="ts">
  import { reportsStore } from '../../stores/reports.svelte'

  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  function formatMonthKey(key: string): string {
    const [year, month] = key.split('-')
    return `${MONTH_NAMES[parseInt(month, 10) - 1]} ${year}`
  }

  const available = $derived(reportsStore.availableMonths)
  const fromMonth = $derived(
    reportsStore.selectedMonths.length > 0
      ? [...reportsStore.selectedMonths].sort()[0]
      : ''
  )
  const toMonth = $derived(
    reportsStore.selectedMonths.length > 0
      ? [...reportsStore.selectedMonths].sort().at(-1) ?? ''
      : ''
  )

  function buildRange(from: string, to: string): string[] {
    if (!from || !to) return []
    const sorted = [...available].sort()
    const fromIdx = sorted.indexOf(from)
    const toIdx = sorted.indexOf(to)
    if (fromIdx < 0 || toIdx < 0) return []
    const start = Math.min(fromIdx, toIdx)
    const end = Math.max(fromIdx, toIdx)
    return sorted.slice(start, end + 1)
  }

  async function handleFromChange(e: Event): Promise<void> {
    const value = (e.target as HTMLSelectElement).value
    const range = buildRange(value, toMonth || value)
    await reportsStore.selectMonths(range)
  }

  async function handleToChange(e: Event): Promise<void> {
    const value = (e.target as HTMLSelectElement).value
    const range = buildRange(fromMonth || value, value)
    await reportsStore.selectMonths(range)
  }
</script>

{#if available.length > 0}
  <div class="month-selector">
    <label class="selector-label">
      From
      <select value={fromMonth} onchange={handleFromChange}>
        {#each [...available].reverse() as month (month)}
          <option value={month}>{formatMonthKey(month)}</option>
        {/each}
      </select>
    </label>

    <label class="selector-label">
      To
      <select value={toMonth} onchange={handleToChange}>
        {#each [...available].reverse() as month (month)}
          <option value={month}>{formatMonthKey(month)}</option>
        {/each}
      </select>
    </label>

    <span class="month-count">
      {reportsStore.selectedMonths.length} month{reportsStore.selectedMonths.length !== 1 ? 's' : ''} selected
    </span>
  </div>
{/if}

<style>
  .month-selector {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .selector-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8125rem;
    color: #555;
    font-weight: 500;
  }

  select {
    padding: 6px 10px;
    font-size: 0.8125rem;
    font-family: inherit;
    border: 1px solid #ddd;
    border-radius: 6px;
    background: #fff;
    color: #1a1a1a;
    cursor: pointer;
  }

  select:focus {
    outline: none;
    border-color: #0066cc;
  }

  .month-count {
    font-size: 0.75rem;
    color: #888;
  }
</style>
