<script lang="ts">
  import { getRoute, goSettings } from './router.svelte'
  import { settingsStore } from './stores/settings.svelte'
  import { currentAppStore } from './stores/current-app.svelte'
  import Header from './components/layout/Header.svelte'
  import Settings from './screens/Settings.svelte'
  import HomeGrid from './screens/HomeGrid.svelte'
  import AppDashboard from './screens/AppDashboard.svelte'
  import StoreListingEditor from './screens/StoreListingEditor.svelte'

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
    <main class="placeholder">
      <p>Screenshot Manager (Phase 5.5)</p>
    </main>
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
