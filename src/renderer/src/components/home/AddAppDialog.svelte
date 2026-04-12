<script lang="ts">
  interface Props {
    open: boolean
    onclose: () => void
    oncreate: (appName: string, packageName: string) => void
  }
  let { open, onclose, oncreate }: Props = $props()

  let appName = $state('')
  let packageName = $state('')
  let error = $state<string | null>(null)
  let creating = $state(false)

  let dialogEl: HTMLDialogElement | undefined = $state()

  const INVALID_CHARS = /[/\\:*?"<>|]/
  const PACKAGE_PATTERN = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/

  $effect(() => {
    if (open && dialogEl && !dialogEl.open) {
      appName = ''
      packageName = ''
      error = null
      creating = false
      dialogEl.showModal()
      // Focus first input after modal opens
      requestAnimationFrame(() => {
        dialogEl?.querySelector<HTMLInputElement>('input')?.focus()
      })
    } else if (!open && dialogEl?.open) {
      dialogEl.close()
    }
  })

  function validate(): string | null {
    const trimmedName = appName.trim()
    if (!trimmedName) return 'App name is required'
    if (INVALID_CHARS.test(trimmedName))
      return 'App name contains invalid characters: / \\ : * ? " < > |'

    const trimmedPackage = packageName.trim()
    if (!trimmedPackage) return 'Package name is required'
    if (!PACKAGE_PATTERN.test(trimmedPackage))
      return 'Package name must be a valid Android package (e.g., com.example.myapp)'

    return null
  }

  function handleSubmit(): void {
    const err = validate()
    if (err) {
      error = err
      return
    }
    creating = true
    oncreate(appName.trim(), packageName.trim())
  }

  function handleDialogClose(): void {
    onclose()
  }
</script>

<dialog bind:this={dialogEl} onclose={handleDialogClose}>
  <form onsubmit={(e) => { e.preventDefault(); handleSubmit() }}>
    <h2>Add New App</h2>

    <label class="field">
      <span class="label">App Name</span>
      <input
        type="text"
        bind:value={appName}
        placeholder="My Cool App"
        disabled={creating}
      />
    </label>

    <label class="field">
      <span class="label">Package Name</span>
      <input
        type="text"
        bind:value={packageName}
        placeholder="com.example.mycoolapp"
        disabled={creating}
      />
    </label>

    {#if error}
      <p class="error">{error}</p>
    {/if}

    <div class="actions">
      <button type="button" class="btn-cancel" onclick={onclose} disabled={creating}>
        Cancel
      </button>
      <button type="submit" class="btn-create" disabled={creating}>
        {creating ? 'Creating...' : 'Create'}
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
    margin: auto;
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
  .btn-create {
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

  .btn-create {
    background: #0066cc;
    color: #fff;
  }

  .btn-create:hover:not(:disabled) {
    background: #0055aa;
  }

  .btn-cancel:disabled,
  .btn-create:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
