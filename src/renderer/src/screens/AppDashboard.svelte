<script lang="ts">
  import { getRoute } from '../router.svelte'
  import { goToScreenshots, goToReports, goToReleaseNotes } from '../router.svelte'
  import { currentAppStore } from '../stores/current-app.svelte'
  import { settingsStore } from '../stores/settings.svelte'
  import { progressStore } from '../stores/progress.svelte'
  import { ipc } from '$lib/ipc'
  import AppDetailsForm from '../components/dashboard/AppDetailsForm.svelte'
  import VersionCard from '../components/dashboard/VersionCard.svelte'
  import ConfirmDialog from '../components/shared/ConfirmDialog.svelte'
  import ProgressPanel from '../components/shared/ProgressPanel.svelte'
  import type { AppDetails } from '$shared/types/models'

  const route = $derived(getRoute())
  const appPath = $derived(route.screen === 'dashboard' ? route.appPath : '')

  let showDeleteAppConfirm = $state(false)
  let showImportConfirm = $state(false)
  let detailsExpanded = $state(true)

  $effect(() => {
    if (appPath) {
      currentAppStore.load(appPath)
    }
  })

  // Listen for menu bar actions
  $effect(() => {
    function onMenuPublish(): void {
      handlePublish()
    }
    function onMenuImport(): void {
      showImportConfirm = true
    }
    window.addEventListener('menu:publish', onMenuPublish)
    window.addEventListener('menu:import-live', onMenuImport)
    return () => {
      window.removeEventListener('menu:publish', onMenuPublish)
      window.removeEventListener('menu:import-live', onMenuImport)
    }
  })

  function handleSaveDetails(details: AppDetails): void {
    currentAppStore.saveDetails(details)
  }

  async function handleCreateNewListing(): Promise<void> {
    await currentAppStore.createNewListing()
  }

  async function handleDeleteApp(): Promise<void> {
    showDeleteAppConfirm = false
    await currentAppStore.deleteApp()
  }

  async function handlePublish(): Promise<void> {
    const liveVersion = currentAppStore.liveVersion
    if (!liveVersion || !appPath || !currentAppStore.config || !settingsStore.serviceAccountKeyPath) return

    progressStore.subscribe()
    try {
      await ipc.publish({
        packageName: currentAppStore.config.packageName,
        serviceAccountKeyPath: settingsStore.serviceAccountKeyPath,
        versionDir: liveVersion.dirPath,
        appPath
      })
      await currentAppStore.refresh()
    } catch {
      // Error is shown in ProgressPanel
    }
  }

  async function handleImportOverwrite(): Promise<void> {
    showImportConfirm = false
    const liveVersion = currentAppStore.liveVersion
    if (!liveVersion || !currentAppStore.config || !settingsStore.serviceAccountKeyPath) return

    progressStore.subscribe()
    try {
      await ipc.importLive({
        packageName: currentAppStore.config.packageName,
        serviceAccountKeyPath: settingsStore.serviceAccountKeyPath,
        targetDir: liveVersion.dirPath,
        mode: 'overwrite-version'
      })
      await currentAppStore.refresh()
    } catch {
      // Error is shown in ProgressPanel
    }
  }
</script>

<main class="dashboard-page">
  {#if currentAppStore.loading}
    <p class="status">Loading...</p>
  {:else if currentAppStore.error}
    <div class="error-banner">{currentAppStore.error}</div>
  {:else if currentAppStore.config}
    <div class="dashboard-header">
      <div class="header-info">
        <h1>{currentAppStore.config.appName}</h1>
        <span class="package-name">{currentAppStore.config.packageName}</span>
      </div>
      <div class="header-actions">
        <button
          class="btn btn-primary"
          onclick={handlePublish}
          disabled={progressStore.active || !settingsStore.serviceAccountKeyPath || !currentAppStore.liveVersion}
          title={!settingsStore.serviceAccountKeyPath ? 'Configure service account key in Settings' : !currentAppStore.liveVersion ? 'No live version to publish' : ''}
        >
          Publish to Play
        </button>
        <button
          class="btn btn-secondary"
          onclick={() => (showImportConfirm = true)}
          disabled={progressStore.active || !settingsStore.serviceAccountKeyPath || !currentAppStore.liveVersion}
          title={!settingsStore.serviceAccountKeyPath ? 'Configure service account key in Settings' : ''}
        >
          Import from Play
        </button>
        <button class="btn btn-secondary" onclick={() => goToScreenshots(appPath)}>
          Screenshot Manager
        </button>
        <button class="btn btn-secondary" onclick={() => goToReports(appPath)}>
          Financial Reports
        </button>
        <button class="btn btn-secondary" onclick={() => goToReleaseNotes(appPath)}>
          Release Notes
        </button>
        <button class="btn btn-danger" onclick={() => (showDeleteAppConfirm = true)}>
          Delete App
        </button>
      </div>
    </div>

    <ProgressPanel />

    <!-- App Details Section -->
    <section class="section">
      <button class="section-header" onclick={() => (detailsExpanded = !detailsExpanded)}>
        <h2>App Details</h2>
        <span class="toggle">{detailsExpanded ? '−' : '+'}</span>
      </button>
      {#if detailsExpanded && currentAppStore.details}
        <div class="section-body">
          <AppDetailsForm
            details={currentAppStore.details}
            onsave={handleSaveDetails}
          />
        </div>
      {/if}
    </section>

    <!-- Versions Section -->
    <section class="section">
      <div class="versions-header">
        <h2>Store Listing Versions</h2>
        <div class="versions-controls">
          <button class="btn btn-primary" onclick={handleCreateNewListing}>
            + New Listing
          </button>
          <label class="toggle-label">
            <input
              type="checkbox"
              bind:checked={currentAppStore.showArchived}
            />
            Show Archived
          </label>
        </div>
      </div>

      {#if currentAppStore.visibleVersions.length === 0}
        <p class="empty">No store listing versions yet. Create one to get started.</p>
      {:else}
        <div class="versions-list">
          {#each currentAppStore.visibleVersions as version (version.dirPath)}
            <VersionCard {version} />
          {/each}
        </div>
      {/if}
    </section>
  {/if}
</main>

<ConfirmDialog
  open={showDeleteAppConfirm}
  title="Delete App"
  message={`Are you sure you want to delete "${currentAppStore.config?.appName ?? 'this app'}"? This will move the entire app directory to the trash.`}
  confirmLabel="Delete App"
  confirmDanger={true}
  onconfirm={handleDeleteApp}
  oncancel={() => (showDeleteAppConfirm = false)}
/>

<ConfirmDialog
  open={showImportConfirm}
  title="Import from Google Play"
  message={`This will overwrite the live version "${currentAppStore.liveVersion?.dirName ?? ''}" with data from Google Play. Are you sure?`}
  confirmLabel="Import & Overwrite"
  confirmDanger={true}
  onconfirm={handleImportOverwrite}
  oncancel={() => (showImportConfirm = false)}
/>

<style>
  .dashboard-page {
    padding: 24px;
    height: calc(100vh - 48px);
    overflow-y: auto;
    max-width: 800px;
    margin: 0 auto;
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
  }

  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 24px;
  }

  .header-info h1 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0;
  }

  .package-name {
    font-size: 0.8125rem;
    color: #888;
    font-family: 'SF Mono', 'Fira Code', monospace;
  }

  .header-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  .btn {
    padding: 8px 16px;
    font-size: 0.875rem;
    font-family: inherit;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    white-space: nowrap;
  }

  .btn-primary {
    background: #0066cc;
    color: #fff;
  }

  .btn-primary:hover {
    background: #0055aa;
  }

  .btn-secondary {
    background: #f0f0f0;
    color: #333;
  }

  .btn-secondary:hover {
    background: #e0e0e0;
  }

  .btn-danger {
    background: #fff0f0;
    color: #d32f2f;
  }

  .btn-danger:hover {
    background: #fde0e0;
  }

  .section {
    background: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    margin-bottom: 20px;
    overflow: hidden;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 16px;
    background: none;
    border: none;
    cursor: pointer;
    font-family: inherit;
  }

  .section-header:hover {
    background: #fafafa;
  }

  .section-header h2 {
    font-size: 1rem;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0;
  }

  .toggle {
    font-size: 1.25rem;
    color: #888;
    line-height: 1;
  }

  .section-body {
    padding: 0 16px 16px;
  }

  .versions-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    gap: 12px;
    flex-wrap: wrap;
  }

  .versions-header h2 {
    font-size: 1rem;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0;
  }

  .versions-controls {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8125rem;
    color: #555;
    cursor: pointer;
    user-select: none;
  }

  .toggle-label input {
    accent-color: #0066cc;
  }

  .empty {
    padding: 0 16px 16px;
    font-size: 0.875rem;
    color: #888;
  }

  .versions-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 0 16px 16px;
  }
</style>
