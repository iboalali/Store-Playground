<script lang="ts">
  import { getRoute, goHome, goSettings, goToDashboard, goToReportsGlobal } from '../../router.svelte'

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
      <button class="crumb" onclick={() => goToDashboard(route.appPath)}>
        {appName ?? 'App'}
      </button>
      <span class="separator">/</span>
      <span class="crumb active">Financial Reports</span>
    {:else if route.screen === 'reports-global'}
      <button class="crumb" onclick={goHome}>Home</button>
      <span class="separator">/</span>
      <span class="crumb active">Financial Reports</span>
    {:else if route.screen === 'release-notes'}
      <button class="crumb" onclick={goHome}>Home</button>
      <span class="separator">/</span>
      <button class="crumb" onclick={() => goToDashboard(route.appPath)}>
        {appName ?? 'App'}
      </button>
      <span class="separator">/</span>
      <span class="crumb active">Release Notes</span>
    {/if}
  </nav>

  <div class="header-actions">
    <button class="header-btn" onclick={goToReportsGlobal} title="Financial Reports">
      <svg
        width="20"
        height="20"
        viewBox="0 -960 960 960"
        fill="currentColor"
      >
        <path d="M200-120q-33 0-56.5-23.5T120-200v-640h80v640h640v80H200Zm40-120v-360h160v360H240Zm200 0v-560h160v560H440Zm200 0v-200h160v200H640Z" />
      </svg>
    </button>
    <button class="header-btn" onclick={goSettings} title="Settings">
      <svg
        width="20"
        height="20"
        viewBox="0 -960 960 960"
        fill="currentColor"
      >
        <path d="m370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80H370Zm70-80h79l14-106q31-8 57.5-23.5T639-327l99 41 39-68-86-65q5-14 7-29.5t2-31.5q0-16-2-31.5t-7-29.5l86-65-39-68-99 42q-22-23-48.5-38.5T533-694l-13-106h-79l-14 106q-31 8-57.5 23.5T321-633l-99-41-39 68 86 64q-5 15-7 30t-2 32q0 16 2 31t7 30l-86 65 39 68 99-42q22 23 48.5 38.5T427-266l13 106Zm42-180q58 0 99-41t41-99q0-58-41-99t-99-41q-59 0-99.5 41T342-480q0 58 40.5 99t99.5 41Zm-2-140Z" />
      </svg>
    </button>
  </div>
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

  .header-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    -webkit-app-region: no-drag;
  }

  .header-btn {
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
  }

  .header-btn:hover {
    background: #f0f0f0;
    color: #1a1a1a;
  }
</style>
