<script lang="ts">
  import { getRoute } from '../router.svelte'
  import { screenshotManagerStore } from '../stores/screenshot-manager.svelte'
  import VersionSelector from '../components/screenshots/VersionSelector.svelte'
  import ScreenList from '../components/screenshots/ScreenList.svelte'
  import ConfirmDialog from '../components/shared/ConfirmDialog.svelte'

  const route = $derived(getRoute())
  const appPath = $derived(route.screen === 'screenshots' ? route.appPath : '')

  function autofocus(node: HTMLElement): void { node.focus() }

  const store = screenshotManagerStore

  // Dialog state
  let showAddVersionPrompt = $state(false)
  let showDuplicateVersionPrompt = $state(false)
  let showRenameVersionPrompt = $state(false)
  let showDeleteVersionConfirm = $state(false)
  let showAddScreenPrompt = $state(false)
  let showAddVariantPrompt = $state(false)
  let showDuplicateVariantPrompt = $state(false)
  let showDeleteVariantConfirm = $state(false)
  let showRenameScreenPrompt = $state(false)
  let showDeleteScreenConfirm = $state(false)

  let promptInput = $state('')
  let targetScreenSlug = $state<string | null>(null)
  let targetVariantSlug = $state<string | null>(null)

  $effect(() => {
    if (appPath) {
      store.load(appPath)
    }
  })

  // Keyboard shortcuts
  $effect(() => {
    function handleKeydown(e: KeyboardEvent): void {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        if (store.undoAction) {
          store.undo()
        }
      }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  })

  // --- Version actions ---
  function openAddVersion(): void {
    promptInput = ''
    showAddVersionPrompt = true
  }

  function confirmAddVersion(): void {
    showAddVersionPrompt = false
    const name = promptInput.trim().replace(/\s+/g, '_')
    if (name) {
      store.addVersion(name)
    }
  }

  function openDuplicateVersion(): void {
    promptInput = ''
    showDuplicateVersionPrompt = true
  }

  function confirmDuplicateVersion(): void {
    showDuplicateVersionPrompt = false
    const name = promptInput.trim().replace(/\s+/g, '_')
    if (name && store.activeVersionName) {
      store.duplicateVersion(store.activeVersionName, name)
    }
  }

  function openRenameVersion(): void {
    promptInput = store.activeVersionName?.replace(/_/g, ' ') || ''
    showRenameVersionPrompt = true
  }

  function confirmRenameVersion(): void {
    showRenameVersionPrompt = false
    const name = promptInput.trim().replace(/\s+/g, '_')
    if (name && store.activeVersionName && name !== store.activeVersionName) {
      store.renameVersion(store.activeVersionName, name)
    }
  }

  function confirmDeleteVersion(): void {
    showDeleteVersionConfirm = false
    if (store.activeVersionName) {
      store.deleteVersion(store.activeVersionName)
    }
  }

  // --- Screen actions ---
  function openAddScreen(): void {
    promptInput = ''
    showAddScreenPrompt = true
  }

  function confirmAddScreen(): void {
    showAddScreenPrompt = false
    const name = promptInput.trim()
    if (name) {
      store.addScreen(name)
    }
  }

  function openRenameScreen(screenSlug: string): void {
    const screen = store.screens.find((s) => s.slug === screenSlug)
    promptInput = screen?.displayName || ''
    targetScreenSlug = screenSlug
    showRenameScreenPrompt = true
  }

  function confirmRenameScreen(): void {
    showRenameScreenPrompt = false
    const name = promptInput.trim()
    if (name && targetScreenSlug) {
      store.renameScreen(targetScreenSlug, name)
    }
    targetScreenSlug = null
  }

  function openDeleteScreen(screenSlug: string): void {
    targetScreenSlug = screenSlug
    showDeleteScreenConfirm = true
  }

  function confirmDeleteScreen(): void {
    showDeleteScreenConfirm = false
    if (targetScreenSlug) {
      store.deleteScreen(targetScreenSlug)
    }
    targetScreenSlug = null
  }

  // --- Variant actions ---
  function openAddVariant(screenSlug: string): void {
    promptInput = ''
    targetScreenSlug = screenSlug
    showAddVariantPrompt = true
  }

  function confirmAddVariant(): void {
    showAddVariantPrompt = false
    const name = promptInput.trim()
    if (name && targetScreenSlug) {
      store.addVariant(targetScreenSlug, name)
    }
    targetScreenSlug = null
  }

  function openDuplicateVariant(screenSlug: string, variantSlug: string): void {
    const screen = store.screens.find((s) => s.slug === screenSlug)
    const variant = screen?.variants.find((v) => v.slug === variantSlug)
    promptInput = variant?.displayName ?? ''
    targetScreenSlug = screenSlug
    targetVariantSlug = variantSlug
    showDuplicateVariantPrompt = true
  }

  function confirmDuplicateVariant(): void {
    showDuplicateVariantPrompt = false
    const name = promptInput.trim()
    if (name && targetScreenSlug && targetVariantSlug) {
      store.duplicateVariant(targetScreenSlug, targetVariantSlug, name)
    }
    targetScreenSlug = null
    targetVariantSlug = null
  }

  function openDeleteVariant(screenSlug: string, variantSlug: string): void {
    targetScreenSlug = screenSlug
    targetVariantSlug = variantSlug
    showDeleteVariantConfirm = true
  }

  function confirmDeleteVariant(): void {
    showDeleteVariantConfirm = false
    if (targetScreenSlug && targetVariantSlug) {
      store.deleteVariant(targetScreenSlug, targetVariantSlug)
    }
    targetScreenSlug = null
    targetVariantSlug = null
  }

  function handlePromptKeydown(e: KeyboardEvent, confirmFn: () => void): void {
    if (e.key === 'Enter') {
      e.preventDefault()
      confirmFn()
    }
  }
</script>

<main class="screenshot-page">
  {#if store.loading && !store.config}
    <p class="status">Loading...</p>
  {:else if store.error && !store.config}
    <div class="error-banner">{store.error}</div>
  {:else if store.config && store.config.versionOrder.length === 0}
    <div class="empty-state">
      <p>No screenshot versions yet.</p>
      <button class="btn btn-primary" onclick={openAddVersion}>
        Create First Version
      </button>
    </div>
  {:else}
    <VersionSelector
      versions={store.config?.versionOrder ?? []}
      activeVersion={store.activeVersionName}
      onselect={(name) => store.loadVersionScreens(name)}
      onadd={openAddVersion}
      onduplicate={openDuplicateVersion}
      onrename={openRenameVersion}
      ondelete={() => (showDeleteVersionConfirm = true)}
    />

    {#if store.error}
      <div class="error-banner">{store.error}</div>
    {/if}

    <div class="manager-content">
      <div class="toolbar">
        <button class="btn btn-secondary" onclick={openAddScreen}>
          + Add Screen
        </button>
      </div>

      <ScreenList
        screens={store.screens}
        imageTimestamp={store.imageTimestamp}
        onsetimage={(sSlug, vSlug, path) => store.setVariantImage(sSlug, vSlug, path)}
        onsetimagedata={(sSlug, vSlug, data) => store.setVariantImageFromData(sSlug, vSlug, data)}
        onclearimage={(sSlug, vSlug) => store.clearVariantImage(sSlug, vSlug)}
        ondeletevariant={(sSlug, vSlug) => openDeleteVariant(sSlug, vSlug)}
        onduplicatevariant={(sSlug, vSlug) => openDuplicateVariant(sSlug, vSlug)}
        onmoveimage={(fromS, fromV, toS, toV) => store.moveVariantImage(fromS, fromV, toS, toV)}
        onexternaldrop={(sSlug, vSlug, path) => store.setVariantImage(sSlug, vSlug, path)}
        onaddvariant={(sSlug) => openAddVariant(sSlug)}
        onrenamescreen={(sSlug) => openRenameScreen(sSlug)}
        ondeletescreen={(sSlug) => openDeleteScreen(sSlug)}
        onreorderscreens={(order) => store.reorderScreens(order)}
      />
    </div>

    {#if store.undoAction}
      <button class="undo-fab" onclick={() => store.undo()}>
        Undo: {store.undoAction.label}
      </button>
    {/if}
  {/if}
</main>

<!-- Prompt Dialogs -->
{#if showAddVersionPrompt}
  <div class="prompt-overlay" onclick={() => (showAddVersionPrompt = false)} role="presentation">
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="prompt-dialog" onclick={(e) => e.stopPropagation()} onkeydown={() => {}} role="dialog">
      <h3>New Version</h3>
      <input
        use:autofocus
        type="text"
        bind:value={promptInput}
        placeholder="Version name (e.g., Holiday Update)"
        onkeydown={(e) => handlePromptKeydown(e, confirmAddVersion)}
      />
      <div class="prompt-actions">
        <button class="btn btn-secondary" onclick={() => (showAddVersionPrompt = false)}>Cancel</button>
        <button class="btn btn-primary" onclick={confirmAddVersion} disabled={!promptInput.trim()}>Create</button>
      </div>
    </div>
  </div>
{/if}

{#if showDuplicateVersionPrompt}
  <div class="prompt-overlay" onclick={() => (showDuplicateVersionPrompt = false)} role="presentation">
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="prompt-dialog" onclick={(e) => e.stopPropagation()} onkeydown={() => {}} role="dialog">
      <h3>Duplicate Version</h3>
      <p class="prompt-hint">Copying "{store.activeVersionName?.replace(/_/g, ' ')}"</p>
      <input
        use:autofocus
        type="text"
        bind:value={promptInput}
        placeholder="New version name"
        onkeydown={(e) => handlePromptKeydown(e, confirmDuplicateVersion)}
      />
      <div class="prompt-actions">
        <button class="btn btn-secondary" onclick={() => (showDuplicateVersionPrompt = false)}>Cancel</button>
        <button class="btn btn-primary" onclick={confirmDuplicateVersion} disabled={!promptInput.trim()}>Duplicate</button>
      </div>
    </div>
  </div>
{/if}

{#if showRenameVersionPrompt}
  <div class="prompt-overlay" onclick={() => (showRenameVersionPrompt = false)} role="presentation">
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="prompt-dialog" onclick={(e) => e.stopPropagation()} onkeydown={() => {}} role="dialog">
      <h3>Rename Version</h3>
      <input
        use:autofocus
        type="text"
        bind:value={promptInput}
        placeholder="Version name"
        onkeydown={(e) => handlePromptKeydown(e, confirmRenameVersion)}
      />
      <div class="prompt-actions">
        <button class="btn btn-secondary" onclick={() => (showRenameVersionPrompt = false)}>Cancel</button>
        <button class="btn btn-primary" onclick={confirmRenameVersion} disabled={!promptInput.trim()}>Rename</button>
      </div>
    </div>
  </div>
{/if}

{#if showAddScreenPrompt}
  <div class="prompt-overlay" onclick={() => (showAddScreenPrompt = false)} role="presentation">
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="prompt-dialog" onclick={(e) => e.stopPropagation()} onkeydown={() => {}} role="dialog">
      <h3>Add Screen</h3>
      <input
        use:autofocus
        type="text"
        bind:value={promptInput}
        placeholder="Screen name (e.g., Login, Home)"
        onkeydown={(e) => handlePromptKeydown(e, confirmAddScreen)}
      />
      <div class="prompt-actions">
        <button class="btn btn-secondary" onclick={() => (showAddScreenPrompt = false)}>Cancel</button>
        <button class="btn btn-primary" onclick={confirmAddScreen} disabled={!promptInput.trim()}>Add</button>
      </div>
    </div>
  </div>
{/if}

{#if showRenameScreenPrompt}
  <div class="prompt-overlay" onclick={() => (showRenameScreenPrompt = false)} role="presentation">
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="prompt-dialog" onclick={(e) => e.stopPropagation()} onkeydown={() => {}} role="dialog">
      <h3>Rename Screen</h3>
      <input
        use:autofocus
        type="text"
        bind:value={promptInput}
        placeholder="Screen display name"
        onkeydown={(e) => handlePromptKeydown(e, confirmRenameScreen)}
      />
      <div class="prompt-actions">
        <button class="btn btn-secondary" onclick={() => (showRenameScreenPrompt = false)}>Cancel</button>
        <button class="btn btn-primary" onclick={confirmRenameScreen} disabled={!promptInput.trim()}>Rename</button>
      </div>
    </div>
  </div>
{/if}

{#if showAddVariantPrompt}
  <div class="prompt-overlay" onclick={() => (showAddVariantPrompt = false)} role="presentation">
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="prompt-dialog" onclick={(e) => e.stopPropagation()} onkeydown={() => {}} role="dialog">
      <h3>Add Variant</h3>
      <p class="prompt-hint">Enter a name like "Light Mode", "Dark Mode", or a locale like "Spanish"</p>
      <input
        use:autofocus
        type="text"
        bind:value={promptInput}
        placeholder="Variant name"
        onkeydown={(e) => handlePromptKeydown(e, confirmAddVariant)}
      />
      <div class="prompt-actions">
        <button class="btn btn-secondary" onclick={() => (showAddVariantPrompt = false)}>Cancel</button>
        <button class="btn btn-primary" onclick={confirmAddVariant} disabled={!promptInput.trim()}>Add</button>
      </div>
    </div>
  </div>
{/if}

{#if showDuplicateVariantPrompt}
  <div class="prompt-overlay" onclick={() => (showDuplicateVariantPrompt = false)} role="presentation">
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="prompt-dialog" onclick={(e) => e.stopPropagation()} onkeydown={() => {}} role="dialog">
      <h3>Duplicate Variant</h3>
      <input
        use:autofocus
        type="text"
        bind:value={promptInput}
        placeholder="New variant name"
        onkeydown={(e) => handlePromptKeydown(e, confirmDuplicateVariant)}
      />
      <div class="prompt-actions">
        <button class="btn btn-secondary" onclick={() => (showDuplicateVariantPrompt = false)}>Cancel</button>
        <button class="btn btn-primary" onclick={confirmDuplicateVariant} disabled={!promptInput.trim()}>Duplicate</button>
      </div>
    </div>
  </div>
{/if}

<ConfirmDialog
  open={showDeleteVariantConfirm}
  title="Delete Variant"
  message="Are you sure you want to delete this variant? The image will be moved to the trash."
  confirmLabel="Delete"
  confirmDanger={true}
  onconfirm={confirmDeleteVariant}
  oncancel={() => (showDeleteVariantConfirm = false)}
/>

<ConfirmDialog
  open={showDeleteVersionConfirm}
  title="Delete Version"
  message={`Are you sure you want to delete "${store.activeVersionName?.replace(/_/g, ' ')}"? This will move it to the trash.`}
  confirmLabel="Delete"
  confirmDanger={true}
  onconfirm={confirmDeleteVersion}
  oncancel={() => (showDeleteVersionConfirm = false)}
/>

<ConfirmDialog
  open={showDeleteScreenConfirm}
  title="Delete Screen"
  message={`Are you sure you want to delete this screen? All variant images will be moved to the trash.`}
  confirmLabel="Delete"
  confirmDanger={true}
  onconfirm={confirmDeleteScreen}
  oncancel={() => (showDeleteScreenConfirm = false)}
/>

<style>
  .screenshot-page {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 48px);
    position: relative;
  }

  .status {
    padding: 24px;
    color: #888;
    font-size: 0.875rem;
  }

  .error-banner {
    background: #fef2f2;
    color: #d32f2f;
    padding: 10px 14px;
    font-size: 0.8125rem;
    margin: 0 24px;
    border-radius: 8px;
    margin-top: 12px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    flex: 1;
    color: #888;
    font-size: 0.875rem;
  }

  .manager-content {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
    width: 100%;
  }

  .toolbar {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }

  .undo-fab {
    position: fixed;
    bottom: 24px;
    right: 24px;
    padding: 10px 20px;
    background: #1a1a1a;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 0.8125rem;
    font-family: inherit;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
    z-index: 100;
    transition: background 0.15s;
  }

  .undo-fab:hover {
    background: #333;
  }

  /* Prompt overlay */
  .prompt-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
  }

  .prompt-dialog {
    background: #fff;
    border-radius: 12px;
    padding: 24px;
    width: 400px;
    max-width: 90vw;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  }

  .prompt-dialog h3 {
    margin: 0 0 12px;
    font-size: 1rem;
    color: #1a1a1a;
  }

  .prompt-hint {
    font-size: 0.75rem;
    color: #888;
    margin: 0 0 10px;
  }

  .prompt-dialog input {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #d0d0d0;
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    outline: none;
    box-sizing: border-box;
  }

  .prompt-dialog input:focus {
    border-color: #0066cc;
    box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.1);
  }

  .prompt-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
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

  .btn:disabled {
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
    border: 1px solid #d0d0d0;
  }

  .btn-secondary:hover:not(:disabled) {
    background: #e8e8e8;
  }
</style>
