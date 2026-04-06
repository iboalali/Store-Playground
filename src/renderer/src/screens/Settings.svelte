<script lang="ts">
  import { settingsStore } from '../stores/settings.svelte'
  import { goHome } from '../router.svelte'
</script>

<div class="settings-page">
  <div class="settings-header">
    <h1>Settings</h1>
  </div>

  <div class="settings-content">
    <section class="setting-group">
      <h2 class="setting-label">Workspace Directory</h2>
      <p class="setting-description">
        The root directory where all your Play Store app data is stored. Required to use the
        application.
      </p>
      <div class="setting-row">
        <span class="setting-value" class:placeholder={!settingsStore.workspacePath}>
          {settingsStore.workspacePath ?? 'Not configured'}
        </span>
        <button class="browse-button" onclick={() => settingsStore.pickWorkspaceDirectory()}>
          Browse...
        </button>
      </div>
    </section>

    <section class="setting-group">
      <h2 class="setting-label">Service Account Key</h2>
      <p class="setting-description">
        Google Cloud Service Account JSON key file. Required for publishing and importing from
        Google Play.
      </p>
      <div class="setting-row">
        <span class="setting-value" class:placeholder={!settingsStore.serviceAccountKeyPath}>
          {settingsStore.serviceAccountKeyPath ?? 'Not configured (optional)'}
        </span>
        <button class="browse-button" onclick={() => settingsStore.pickServiceAccountKey()}>
          Browse...
        </button>
      </div>
    </section>

    {#if settingsStore.error}
      <div class="error-banner">{settingsStore.error}</div>
    {/if}

    {#if settingsStore.isConfigured}
      <button class="back-button" onclick={goHome}>Back to Home</button>
    {/if}
  </div>
</div>

<style>
  .settings-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 32px 16px;
    height: calc(100% - 48px);
    overflow-y: auto;
  }

  .settings-header {
    width: 100%;
    max-width: 600px;
    margin-bottom: 24px;
  }

  .settings-header h1 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #1a1a1a;
  }

  .settings-content {
    width: 100%;
    max-width: 600px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .setting-group {
    background: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 16px;
  }

  .setting-label {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #1a1a1a;
    display: block;
    margin-bottom: 4px;
  }

  .setting-description {
    font-size: 0.8125rem;
    color: #666;
    margin-bottom: 12px;
    line-height: 1.4;
  }

  .setting-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .setting-value {
    flex: 1;
    font-family: 'SF Mono', 'Fira Code', 'Fira Mono', Menlo, Consolas, monospace;
    font-size: 0.8125rem;
    color: #1a1a1a;
    background: #f5f5f5;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    padding: 6px 10px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .setting-value.placeholder {
    color: #999;
    font-style: italic;
  }

  .browse-button {
    padding: 6px 14px;
    font-size: 0.8125rem;
    font-family: inherit;
    background: #fff;
    border: 1px solid #d0d0d0;
    border-radius: 6px;
    color: #333;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .browse-button:hover {
    background: #f5f5f5;
    border-color: #bbb;
  }

  .error-banner {
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 6px;
    padding: 10px 14px;
    font-size: 0.8125rem;
    color: #dc2626;
  }

  .back-button {
    align-self: flex-start;
    padding: 8px 20px;
    font-size: 0.875rem;
    font-family: inherit;
    background: #0066cc;
    border: none;
    border-radius: 6px;
    color: #fff;
    cursor: pointer;
  }

  .back-button:hover {
    background: #0052a3;
  }
</style>
