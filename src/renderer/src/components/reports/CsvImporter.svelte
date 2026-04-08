<script lang="ts">
  import { reportsStore } from '../../stores/reports.svelte'
  import { ipc } from '$lib/ipc'

  let dragOver = $state(false)
  let importMessage = $state('')

  async function handleFilePick(): Promise<void> {
    const path = await ipc.openFileDialog({
      title: 'Select Earnings CSV',
      filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    })
    if (path) {
      importMessage = ''
      await reportsStore.importCsv(path)
      importMessage = 'CSV imported successfully'
    }
  }

  function handleDragOver(e: DragEvent): void {
    e.preventDefault()
    dragOver = true
  }

  function handleDragLeave(): void {
    dragOver = false
  }

  async function handleDrop(e: DragEvent): Promise<void> {
    e.preventDefault()
    dragOver = false
    const file = e.dataTransfer?.files[0]
    if (file?.path && file.name.endsWith('.csv')) {
      importMessage = ''
      await reportsStore.importCsv(file.path)
      importMessage = 'CSV imported successfully'
    }
  }

  async function handleDeleteMonth(monthKey: string): Promise<void> {
    await reportsStore.deleteMonth(monthKey)
  }

  function formatMonthKey(key: string): string {
    const [year, month] = key.split('-')
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    return `${monthNames[parseInt(month, 10) - 1]} ${year}`
  }
</script>

<section class="csv-importer">
  <button class="section-toggle" onclick={() => (reportsStore.importerExpanded = !reportsStore.importerExpanded)}>
    <h3>Import Data</h3>
    <span class="toggle-icon">{reportsStore.importerExpanded ? '−' : '+'}</span>
  </button>

  {#if reportsStore.importerExpanded}
    <div class="importer-body">
      <!-- Drop zone -->
      <div
        class="drop-zone"
        class:drag-over={dragOver}
        ondragover={handleDragOver}
        ondragleave={handleDragLeave}
        ondrop={handleDrop}
        role="button"
        tabindex="0"
        onclick={handleFilePick}
        onkeydown={(e) => e.key === 'Enter' && handleFilePick()}
      >
        {#if reportsStore.importing}
          <p class="drop-text">Importing...</p>
        {:else}
          <p class="drop-text">Drop a Google Play earnings CSV here, or click to browse</p>
        {/if}
      </div>

      {#if importMessage}
        <p class="import-message">{importMessage}</p>
      {/if}

      <!-- Imported months list -->
      {#if reportsStore.index && reportsStore.index.importedFiles.length > 0}
        <div class="imported-list">
          <h4>Imported Months</h4>
          {#each reportsStore.index.importedFiles as file (file.monthKey)}
            <div class="imported-item">
              <span class="month-label">{formatMonthKey(file.monthKey)}</span>
              <span class="row-count">{file.rowCount} rows</span>
              <button class="delete-btn" onclick={() => handleDeleteMonth(file.monthKey)} title="Delete this month's data">
                &times;
              </button>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</section>

<style>
  .csv-importer {
    background: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    overflow: hidden;
  }

  .section-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 12px 16px;
    background: none;
    border: none;
    cursor: pointer;
    font-family: inherit;
  }

  .section-toggle:hover {
    background: #fafafa;
  }

  .section-toggle h3 {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0;
  }

  .toggle-icon {
    font-size: 1.125rem;
    color: #888;
  }

  .importer-body {
    padding: 0 16px 16px;
  }

  .drop-zone {
    border: 2px dashed #ccc;
    border-radius: 8px;
    padding: 24px;
    text-align: center;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }

  .drop-zone:hover,
  .drop-zone.drag-over {
    border-color: #0066cc;
    background: #f0f7ff;
  }

  .drop-text {
    color: #666;
    font-size: 0.8125rem;
  }

  .import-message {
    color: #2e7d32;
    font-size: 0.8125rem;
    margin-top: 8px;
  }

  .imported-list {
    margin-top: 12px;
  }

  .imported-list h4 {
    font-size: 0.75rem;
    font-weight: 600;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 6px;
  }

  .imported-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
    font-size: 0.8125rem;
    border-bottom: 1px solid #f0f0f0;
  }

  .imported-item:last-child {
    border-bottom: none;
  }

  .month-label {
    font-weight: 500;
    color: #1a1a1a;
  }

  .row-count {
    color: #888;
    font-size: 0.75rem;
    flex: 1;
  }

  .delete-btn {
    background: none;
    border: none;
    color: #ccc;
    font-size: 1.125rem;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
  }

  .delete-btn:hover {
    color: #d32f2f;
  }
</style>
