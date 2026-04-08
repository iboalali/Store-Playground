<script lang="ts">
  import { getRoute, goSettings } from './router.svelte'
  import { settingsStore } from './stores/settings.svelte'
  import { appStateStore } from './stores/app-state.svelte'
  import { currentAppStore } from './stores/current-app.svelte'
  import { editorStore } from './stores/editor.svelte'
  import { screenshotManagerStore } from './stores/screenshot-manager.svelte'
  import { ipc } from '$lib/ipc'
  import Header from './components/layout/Header.svelte'
  import Settings from './screens/Settings.svelte'
  import HomeGrid from './screens/HomeGrid.svelte'
  import AppDashboard from './screens/AppDashboard.svelte'
  import StoreListingEditor from './screens/StoreListingEditor.svelte'
  import ScreenshotManager from './screens/ScreenshotManager.svelte'
  import type { Route } from './router.svelte'

  let initialized = $state(false)

  $effect(() => {
    if (!initialized) {
      initialized = true
      settingsStore.load().then(() => {
        if (!settingsStore.isConfigured) {
          goSettings()
        }
      })
    }
  })

  const route = $derived(getRoute())

  function refreshForRoute(r: Route): void {
    switch (r.screen) {
      case 'home':
        if (settingsStore.workspacePath) {
          appStateStore.loadWorkspace(settingsStore.workspacePath)
        }
        break
      case 'dashboard':
        currentAppStore.refresh()
        break
      case 'editor':
        editorStore.reload()
        break
      case 'screenshots':
        screenshotManagerStore.reload()
        break
    }
  }

  // Watcher: auto-refresh active store when files change externally
  $effect(() => {
    const unsubscribe = ipc.onWatcherChange(() => {
      refreshForRoute(getRoute())
    })
    return unsubscribe
  })

  // Menu actions: dispatch based on current route
  $effect(() => {
    const unsubscribe = ipc.onMenuAction((action: string) => {
      const r = getRoute()
      switch (action) {
        case 'settings':
          goSettings()
          break
        case 'open-workspace':
          goSettings()
          break
        case 'refresh':
          refreshForRoute(r)
          break
        case 'save':
          if (r.screen === 'editor' && editorStore.isDirty && !editorStore.saving) {
            editorStore.saveTexts()
          }
          break
        case 'new-listing':
          if (r.screen === 'dashboard') {
            currentAppStore.createNewListing()
          }
          break
        case 'toggle-archived':
          if (r.screen === 'dashboard') {
            currentAppStore.showArchived = !currentAppStore.showArchived
          }
          break
        case 'publish':
          if (r.screen === 'dashboard') {
            window.dispatchEvent(new CustomEvent('menu:publish'))
          }
          break
        case 'import-live':
          if (r.screen === 'dashboard') {
            window.dispatchEvent(new CustomEvent('menu:import-live'))
          }
          break
        case 'add-localization':
          if (r.screen === 'editor') {
            window.dispatchEvent(new CustomEvent('menu:add-localization'))
          }
          break
        case 'new-app':
          if (r.screen === 'home') {
            window.dispatchEvent(new CustomEvent('menu:new-app'))
          }
          break
      }
    })
    return unsubscribe
  })
</script>

{#if !settingsStore.loaded}
  <div class="loading">
    <p>Loading...</p>
  </div>
{:else}
  <Header appName={currentAppStore.config?.appName} />
  {#if route.screen === 'settings'}
    <Settings />
  {:else if route.screen === 'home'}
    <HomeGrid />
  {:else if route.screen === 'dashboard'}
    <AppDashboard />
  {:else if route.screen === 'editor'}
    <StoreListingEditor />
  {:else if route.screen === 'screenshots'}
    <ScreenshotManager />
  {:else if route.screen === 'reports'}
    <main class="placeholder">
      <p>Financial Reports (Phase 9)</p>
    </main>
  {/if}
{/if}

<style>
  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    color: #666;
  }

  .placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    height: calc(100vh - 48px);
    color: #999;
    font-size: 1.125rem;
  }
</style>
