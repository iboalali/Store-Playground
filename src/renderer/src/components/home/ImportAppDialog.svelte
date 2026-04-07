<script lang="ts">
  import { settingsStore } from '../../stores/settings.svelte'

  interface Props {
    open: boolean
    onclose: () => void
    onimport: (packageName: string) => void
  }
  let { open, onclose, onimport }: Props = $props()

  let packageName = $state('')
  let error = $state<string | null>(null)
  let importing = $state(false)

  let dialogEl: HTMLDialogElement | undefined = $state()

  const PACKAGE_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/

  $effect(() => {
    if (open && dialogEl && !dialogEl.open) {
      packageName = ''
      error = null
      importing = false
      dialogEl.showModal()
    } else if (!open && dialogEl?.open) {
      dialogEl.close()
    }
  })

  function validate(): string | null {
    if (!settingsStore.serviceAccountKeyPath) {
      return 'Service account key must be configured in Settings first'
    }

    const trimmed = packageName.trim()
    if (!trimmed) return 'Package name is required'
    if (!PACKAGE_PATTERN.test(trimmed))
      return 'Package name must be a valid Android package (e.g., com.example.myapp)'

    return null
  }

  function handleSubmit(): void {
    const err = validate()
    if (err) {
      error = err
      return
    }
    importing = true
    onimport(packageName.trim())
  }

  function handleDialogClose(): void {
    onclose()
  }
</script>

<dialog bind:this={dialogEl} onclose={handleDialogClose}>
  <form onsubmit={(e) => { e.preventDefault(); handleSubmit() }}>
    <h2>Import from Google Play</h2>

    {#if !settingsStore.serviceAccountKeyPath}
      <p class="warning">A service account key must be configured in Settings before importing.</p>
    {/if}

    <label class="field">
      <span class="label">Package Name</span>
      <input
        type="text"
        bind:value={packageName}
        placeholder="com.example.myapp"
        disabled={importing}
      />
      <span class="hint">The Android application ID as listed on Google Play</span>
    </label>

    {#if error}
      <p class="error">{error}</p>
    {/if}

    <div class="actions">
      <button type="button" class="btn-cancel" onclick={onclose} disabled={importing}>
        Cancel
      </button>
      <button
        type="submit"
        class="btn-import"
        disabled={importing || !settingsStore.serviceAccountKeyPath}
      >
        {importing ? 'Importing...' : 'Import'}
      </button>
    </div>
  </form>
</dialog>

<style>
  dialog {
    border: none;
    border-radius: 12px;
    padding: 24px;
    width: 400px;
    max-width: 90vw;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
    font-family: inherit;
  }

  dialog::backdrop {
    background: rgba(0, 0, 0, 0.4);
  }

  h2 {
    margin: 0 0 20px;
    font-size: 1.125rem;
    font-weight: 600;
    color: #1a1a1a;
  }

  .warning {
    background: #fff8e1;
    color: #f57f17;
    padding: 10px 14px;
    border-radius: 6px;
    font-size: 0.8125rem;
    margin: 0 0 16px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 16px;
  }

  .label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: #555;
  }

  .hint {
    font-size: 0.75rem;
    color: #999;
  }

  input {
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s;
  }

  input:focus {
    border-color: #0066cc;
  }

  input:disabled {
    background: #f5f5f5;
    color: #999;
  }

  .error {
    color: #d32f2f;
    font-size: 0.8125rem;
    margin: 0 0 12px;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 8px;
  }

  .btn-cancel,
  .btn-import {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    cursor: pointer;
    border: none;
  }

  .btn-cancel {
    background: #f0f0f0;
    color: #555;
  }

  .btn-cancel:hover:not(:disabled) {
    background: #e0e0e0;
  }

  .btn-import {
    background: #0066cc;
    color: #fff;
  }

  .btn-import:hover:not(:disabled) {
    background: #0055aa;
  }

  .btn-cancel:disabled,
  .btn-import:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
