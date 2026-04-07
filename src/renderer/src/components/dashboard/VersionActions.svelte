<script lang="ts">
  import { getRoute } from '../../router.svelte'
  import { goToEditor } from '../../router.svelte'
  import { currentAppStore } from '../../stores/current-app.svelte'
  import ConfirmDialog from '../shared/ConfirmDialog.svelte'
  import type { VersionEntry } from '$shared/types/models'

  interface Props {
    version: VersionEntry
  }
  let { version }: Props = $props()

  const route = $derived(getRoute())
  const appPath = $derived(route.screen === 'dashboard' ? route.appPath : '')

  let showDeleteConfirm = $state(false)
  let showRenameInput = $state(false)
  let showDuplicateInput = $state(false)
  let nameInput = $state('')
  let busy = $state(false)

  const INVALID_CHARS = /[/\\:*?"<>|]/

  function validateName(name: string): string | null {
    const trimmed = name.trim()
    if (!trimmed) return 'Name is required'
    if (INVALID_CHARS.test(trimmed)) return 'Name contains invalid characters'
    return null
  }

  async function handleSetLive(): Promise<void> {
    busy = true
    await currentAppStore.saveConfig({ liveVersionDir: version.dirName })
    busy = false
  }

  function startRename(): void {
    nameInput = version.dirName
    showRenameInput = true
    showDuplicateInput = false
  }

  async function confirmRename(): Promise<void> {
    const err = validateName(nameInput)
    if (err) return
    busy = true
    await currentAppStore.renameListing(version.dirName, nameInput.trim())
    showRenameInput = false
    busy = false
  }

  function startDuplicate(): void {
    nameInput = `${version.dirName}_copy`
    showDuplicateInput = true
    showRenameInput = false
  }

  async function confirmDuplicate(): Promise<void> {
    const err = validateName(nameInput)
    if (err) return
    busy = true
    await currentAppStore.duplicateListing(version.dirName, nameInput.trim())
    showDuplicateInput = false
    busy = false
  }

  async function handleArchive(): Promise<void> {
    busy = true
    await currentAppStore.archiveListing(version.dirName)
    busy = false
  }

  async function handleValidate(): Promise<void> {
    busy = true
    await currentAppStore.validateVersion(version.dirName)
    busy = false
  }

  async function handleDelete(): Promise<void> {
    showDeleteConfirm = false
    busy = true
    await currentAppStore.deleteListing(version.dirName)
    busy = false
  }

  function cancelInput(): void {
    showRenameInput = false
    showDuplicateInput = false
    nameInput = ''
  }
</script>

<div class="actions">
  {#if showRenameInput || showDuplicateInput}
    <div class="inline-input">
      <input
        type="text"
        bind:value={nameInput}
        disabled={busy}
        onkeydown={(e) => {
          if (e.key === 'Enter') showRenameInput ? confirmRename() : confirmDuplicate()
          if (e.key === 'Escape') cancelInput()
        }}
      />
      <button
        class="btn-sm btn-primary"
        disabled={busy}
        onclick={() => showRenameInput ? confirmRename() : confirmDuplicate()}
      >
        {busy ? '...' : 'OK'}
      </button>
      <button class="btn-sm btn-secondary" disabled={busy} onclick={cancelInput}>
        Cancel
      </button>
    </div>
  {:else}
    <button class="btn-sm btn-primary" onclick={() => goToEditor(appPath, version.dirName)} disabled={busy}>
      Edit
    </button>
    <button
      class="btn-sm btn-validate"
      disabled={busy || currentAppStore.validatingVersion === version.dirName}
      onclick={handleValidate}
    >
      {currentAppStore.validatingVersion === version.dirName ? 'Validating...' : 'Validate for Publish'}
    </button>
    {#if !version.isLive}
      <button class="btn-sm btn-secondary" onclick={handleSetLive} disabled={busy}>
        Set as Live
      </button>
    {/if}
    <button class="btn-sm btn-secondary" onclick={startDuplicate} disabled={busy}>
      Duplicate
    </button>
    <button class="btn-sm btn-secondary" onclick={startRename} disabled={busy}>
      Rename
    </button>
    {#if version.metadata.status !== 'archived'}
      <button class="btn-sm btn-secondary" onclick={handleArchive} disabled={busy}>
        Archive
      </button>
    {/if}
    <button class="btn-sm btn-danger" onclick={() => (showDeleteConfirm = true)} disabled={busy}>
      Delete
    </button>
  {/if}
</div>

<ConfirmDialog
  open={showDeleteConfirm}
  title="Delete Listing"
  message={`Are you sure you want to delete "${version.dirName}"? This will move it to the trash.`}
  confirmLabel="Delete"
  confirmDanger={true}
  onconfirm={handleDelete}
  oncancel={() => (showDeleteConfirm = false)}
/>

<style>
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }

  .inline-input {
    display: flex;
    gap: 6px;
    align-items: center;
    flex: 1;
  }

  .inline-input input {
    flex: 1;
    padding: 4px 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 0.8125rem;
    font-family: inherit;
    outline: none;
    min-width: 120px;
  }

  .inline-input input:focus {
    border-color: #0066cc;
  }

  .btn-sm {
    padding: 4px 10px;
    font-size: 0.75rem;
    font-family: inherit;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    white-space: nowrap;
  }

  .btn-sm:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: #0066cc;
    color: #fff;
  }

  .btn-primary:hover:not(:disabled) {
    background: #0055aa;
  }

  .btn-secondary {
    background: #f0f0f0;
    color: #333;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #e0e0e0;
  }

  .btn-danger {
    background: #fff0f0;
    color: #d32f2f;
  }

  .btn-danger:hover:not(:disabled) {
    background: #fde0e0;
  }

  .btn-validate {
    background: #e8f5e9;
    color: #2e7d32;
  }

  .btn-validate:hover:not(:disabled) {
    background: #c8e6c9;
  }
</style>
