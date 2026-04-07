<script lang="ts">
  import { progressStore } from '../../stores/progress.svelte'

  let errorsExpanded = $state(false)
</script>

{#if progressStore.event}
  <div class="progress-panel" class:has-error={progressStore.hasErrors && progressStore.finished}>
    <div class="progress-header">
      <span class="progress-title">
        {#if progressStore.finished}
          {#if progressStore.hasErrors}
            {progressStore.operationType === 'publish' ? 'Publish failed' : 'Import failed'}
          {:else}
            {progressStore.operationType === 'publish' ? 'Published successfully' : 'Import complete'}
          {/if}
        {:else}
          {progressStore.operationType === 'publish' ? 'Publishing to Google Play...' : 'Importing from Google Play...'}
        {/if}
      </span>
      {#if progressStore.finished}
        <button class="btn-dismiss" onclick={() => progressStore.dismiss()}>Dismiss</button>
      {/if}
    </div>

    <div class="steps-list">
      {#each progressStore.steps as step (step.id)}
        <div class="step" class:step-active={step.status === 'active'} class:step-done={step.status === 'done'} class:step-error={step.status === 'error'}>
          <span class="step-icon">
            {#if step.status === 'active'}
              <span class="spinner"></span>
            {:else if step.status === 'done'}
              ✓
            {:else if step.status === 'error'}
              ✕
            {:else}
              ·
            {/if}
          </span>
          <span class="step-label">{step.label}</span>
        </div>
      {/each}
    </div>

    {#if progressStore.hasErrors && progressStore.finished}
      <div class="error-section">
        {#if progressStore.abortError}
          <div class="abort-error">{progressStore.abortError}</div>
        {/if}
        {#if progressStore.errors.length > 0}
          <button class="error-toggle" onclick={() => (errorsExpanded = !errorsExpanded)}>
            {errorsExpanded ? '▾' : '▸'} {progressStore.errors.length} error{progressStore.errors.length !== 1 ? 's' : ''}
          </button>
          {#if errorsExpanded}
            <ul class="error-list">
              {#each progressStore.errors as err (err.id)}
                <li>{err.label}: {err.error}</li>
              {/each}
            </ul>
          {/if}
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .progress-panel {
    background: #f8f9fa;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 20px;
  }

  .progress-panel.has-error {
    border-color: #f5c6cb;
    background: #fef2f2;
  }

  .progress-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .progress-title {
    font-weight: 600;
    font-size: 0.875rem;
    color: #1a1a1a;
  }

  .btn-dismiss {
    padding: 4px 12px;
    font-size: 0.75rem;
    font-family: inherit;
    border: 1px solid #d0d0d0;
    border-radius: 4px;
    background: #fff;
    color: #555;
    cursor: pointer;
  }

  .btn-dismiss:hover {
    background: #f0f0f0;
  }

  .steps-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 200px;
    overflow-y: auto;
  }

  .step {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 0.8125rem;
    color: #888;
  }

  .step-active {
    color: #0066cc;
    font-weight: 500;
  }

  .step-done {
    color: #2e7d32;
  }

  .step-error {
    color: #d32f2f;
  }

  .step-icon {
    width: 16px;
    text-align: center;
    flex-shrink: 0;
  }

  .spinner {
    display: inline-block;
    width: 12px;
    height: 12px;
    border: 2px solid #0066cc;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .error-section {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #f5c6cb;
  }

  .abort-error {
    font-size: 0.8125rem;
    color: #d32f2f;
    margin-bottom: 8px;
    word-break: break-word;
  }

  .error-toggle {
    background: none;
    border: none;
    font-family: inherit;
    font-size: 0.8125rem;
    color: #d32f2f;
    cursor: pointer;
    padding: 0;
  }

  .error-list {
    margin: 8px 0 0 0;
    padding-left: 20px;
    font-size: 0.75rem;
    color: #d32f2f;
  }

  .error-list li {
    margin-bottom: 4px;
    word-break: break-word;
  }
</style>
