<script lang="ts">
  import { getRoute, goHome, goSettings, goToDashboard } from '../../router.svelte'

  interface Props {
    appName?: string
  }
  let { appName }: Props = $props()

  const route = $derived(getRoute())
</script>

<header class="app-header">
  <nav class="breadcrumbs">
    {#if route.screen === 'home'}
      <span class="crumb active">Home</span>
    {:else if route.screen === 'settings'}
      <button class="crumb" onclick={goHome}>Home</button>
      <span class="separator">/</span>
      <span class="crumb active">Settings</span>
    {:else if route.screen === 'dashboard'}
      <button class="crumb" onclick={goHome}>Home</button>
      <span class="separator">/</span>
      <span class="crumb active">{appName ?? 'App'}</span>
    {:else if route.screen === 'editor'}
      <button class="crumb" onclick={goHome}>Home</button>
      <span class="separator">/</span>
      <button class="crumb" onclick={() => goToDashboard(route.appPath)}>
        {appName ?? 'App'}
      </button>
      <span class="separator">/</span>
      <span class="crumb active">Store Listing</span>
    {:else if route.screen === 'screenshots'}
      <button class="crumb" onclick={goHome}>Home</button>
      <span class="separator">/</span>
      <button class="crumb" onclick={() => goToDashboard(route.appPath)}>
        {appName ?? 'App'}
      </button>
      <span class="separator">/</span>
      <span class="crumb active">Screenshots</span>
    {:else if route.screen === 'reports'}
      <button class="crumb" onclick={goHome}>Home</button>
      <span class="separator">/</span>
      <span class="crumb active">Financial Reports</span>
    {/if}
  </nav>

  <button class="gear-button" onclick={goSettings} title="Settings">
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="10" cy="10" r="3" />
      <path
        d="M10 1.5v2M10 16.5v2M3.4 3.4l1.4 1.4M15.2 15.2l1.4 1.4M1.5 10h2M16.5 10h2M3.4 16.6l1.4-1.4M15.2 4.8l1.4-1.4"
      />
    </svg>
  </button>
</header>

<style>
  .app-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 48px;
    padding: 0 16px;
    background: #fff;
    border-bottom: 1px solid #e0e0e0;
    -webkit-app-region: drag;
    flex-shrink: 0;
  }

  .breadcrumbs {
    display: flex;
    align-items: center;
    gap: 4px;
    -webkit-app-region: no-drag;
  }

  .crumb {
    font-size: 0.875rem;
    color: #555;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-family: inherit;
  }

  .crumb:hover:not(.active) {
    text-decoration: underline;
    color: #0066cc;
  }

  .crumb.active {
    font-weight: 600;
    color: #1a1a1a;
    cursor: default;
  }

  .separator {
    color: #999;
    font-size: 0.875rem;
  }

  .gear-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 6px;
    background: none;
    color: #555;
    cursor: pointer;
    -webkit-app-region: no-drag;
  }

  .gear-button:hover {
    background: #f0f0f0;
    color: #1a1a1a;
  }
</style>
