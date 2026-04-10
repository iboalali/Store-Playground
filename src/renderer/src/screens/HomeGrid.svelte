<script lang="ts">
  import { settingsStore } from '../stores/settings.svelte'
  import { appStateStore } from '../stores/app-state.svelte'
  import { progressStore } from '../stores/progress.svelte'
  import { ipc } from '$lib/ipc'
  import AppCard from '../components/home/AppCard.svelte'
  import AddAppDialog from '../components/home/AddAppDialog.svelte'
  import ImportAppDialog from '../components/home/ImportAppDialog.svelte'
  import ProgressPanel from '../components/shared/ProgressPanel.svelte'

  let showAddDialog = $state(false)
  let showImportDialog = $state(false)
  let createError = $state<string | null>(null)
  let importConfigError = $state<string | null>(null)

  $effect(() => {
    const wp = settingsStore.workspacePath
    if (wp) {
      appStateStore.loadWorkspace(wp)
    }
  })

  // Listen for menu bar action
  $effect(() => {
    function onMenuNewApp(): void {
      showAddDialog = true
    }
    window.addEventListener('menu:new-app', onMenuNewApp)
    return () => window.removeEventListener('menu:new-app', onMenuNewApp)
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

  function handleCloseImportDialog(): void {
    showImportDialog = false
  }

  function joinPath(base: string, ...rest: string[]): string {
    const sep = base.includes('\\') ? '\\' : '/'
    return [base, ...rest].join(sep)
  }

  async function handleImport(packageName: string): Promise<void> {
    const wp = settingsStore.workspacePath
    if (!wp || !settingsStore.serviceAccountKeyPath) return

    showImportDialog = false
    progressStore.subscribe()
    try {
      await ipc.importLive({
        packageName,
        serviceAccountKeyPath: settingsStore.serviceAccountKeyPath,
        targetDir: joinPath(wp, packageName),
        mode: 'new-app'
      })
      await appStateStore.refresh(wp)
    } catch {
      // Error shown in ProgressPanel
    }
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
  {#if importConfigError}
    <div class="error-banner">{importConfigError}</div>
  {/if}

  <ProgressPanel />

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
      <button
        class="add-card"
        onclick={() => {
          if (!settingsStore.serviceAccountKeyPath) {
            importConfigError = 'Configure a Service Account Key in Settings first'
            return
          }
          importConfigError = null
          showImportDialog = true
        }}
        disabled={progressStore.active}
      >
        <svg class="add-icon" width="32" height="32" viewBox="0 -960 960 960" fill="currentColor">
          <path d="M260-160q-91 0-155.5-63T40-377q0-78 47-139t123-78q17-72 85-137t145-65q33 0 56.5 23.5T520-716v242l64-62 56 56-160 160-160-160 56-56 64 62v-242q-76 14-118 73.5T280-520h-20q-58 0-99 41t-41 99q0 58 41 99t99 41h480q42 0 71-29t29-71q0-42-29-71t-71-29h-60v-80q0-48-22-89.5T600-680v-93q74 35 117 103.5T760-520q69 8 114.5 59.5T920-340q0 75-52.5 127.5T740-160H260Zm220-358Z" />
        </svg>
        <span class="add-label">Import from Play</span>
      </button>
    </div>
  {/if}
</main>

<AddAppDialog
  open={showAddDialog}
  onclose={handleCloseDialog}
  oncreate={handleCreate}
/>

<ImportAppDialog
  open={showImportDialog}
  onclose={handleCloseImportDialog}
  onimport={handleImport}
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

  .add-icon {
    color: #999;
  }

  .add-card:hover .plus-icon,
  .add-card:hover .add-icon {
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
