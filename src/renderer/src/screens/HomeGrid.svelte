<script lang="ts">
  import { settingsStore } from '../stores/settings.svelte'
  import { appStateStore } from '../stores/app-state.svelte'
  import { ipc } from '$lib/ipc'
  import AppCard from '../components/home/AppCard.svelte'
  import AddAppDialog from '../components/home/AddAppDialog.svelte'

  let showAddDialog = $state(false)
  let createError = $state<string | null>(null)

  $effect(() => {
    const wp = settingsStore.workspacePath
    if (wp) {
      appStateStore.loadWorkspace(wp)
    }
  })

  async function handleCreate(appName: string, packageName: string): Promise<void> {
    const wp = settingsStore.workspacePath
    if (!wp) return

    createError = null
    try {
      await ipc.createApp({ workspacePath: wp, appName, packageName })
      showAddDialog = false
      await appStateStore.refresh(wp)
    } catch (err) {
      createError = String(err)
    }
  }

  function handleCloseDialog(): void {
    showAddDialog = false
    createError = null
  }
</script>

<main class="home-grid-page">
  <div class="grid-header">
    <h1>Your Apps</h1>
    {#if appStateStore.appCount > 0}
      <span class="app-count">{appStateStore.appCount} app{appStateStore.appCount !== 1 ? 's' : ''}</span>
    {/if}
  </div>

  {#if createError}
    <div class="error-banner">{createError}</div>
  {/if}

  {#if appStateStore.loading}
    <p class="status">Loading apps...</p>
  {:else if appStateStore.error}
    <div class="error-banner">{appStateStore.error}</div>
  {:else}
    <div class="app-grid">
      {#each appStateStore.sortedApps as appEntry (appEntry.appPath)}
        <AppCard {appEntry} />
      {/each}
      <button class="add-card" onclick={() => (showAddDialog = true)}>
        <span class="plus-icon">+</span>
        <span class="add-label">Add App</span>
      </button>
    </div>
  {/if}
</main>

<AddAppDialog
  open={showAddDialog}
  onclose={handleCloseDialog}
  oncreate={handleCreate}
/>

<style>
  .home-grid-page {
    padding: 24px;
    height: calc(100vh - 48px);
    overflow-y: auto;
  }

  .grid-header {
    display: flex;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 24px;
  }

  .grid-header h1 {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1a1a1a;
  }

  .app-count {
    font-size: 0.875rem;
    color: #888;
  }

  .status {
    color: #888;
    font-size: 0.875rem;
  }

  .error-banner {
    background: #fef2f2;
    color: #d32f2f;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 0.8125rem;
    margin-bottom: 16px;
  }

  .app-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 16px;
  }

  .add-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 20px 16px;
    min-height: 140px;
    background: #fafafa;
    border: 2px dashed #d0d0d0;
    border-radius: 12px;
    cursor: pointer;
    font-family: inherit;
    transition: border-color 0.15s, background 0.15s;
  }

  .add-card:hover {
    border-color: #0066cc;
    background: #f0f7ff;
  }

  .plus-icon {
    font-size: 2rem;
    color: #999;
    line-height: 1;
  }

  .add-card:hover .plus-icon {
    color: #0066cc;
  }

  .add-label {
    font-size: 0.875rem;
    color: #888;
  }

  .add-card:hover .add-label {
    color: #0066cc;
  }
</style>
