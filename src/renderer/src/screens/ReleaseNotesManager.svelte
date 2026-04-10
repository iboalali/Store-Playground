<script lang="ts">
  import { getRoute } from '../router.svelte'
  import { releaseNotesStore } from '../stores/release-notes.svelte'
  import VersionSelector from '../components/release-notes/VersionSelector.svelte'
  import LanguageList from '../components/release-notes/LanguageList.svelte'
  import GenerateDialog from '../components/release-notes/GenerateDialog.svelte'
  import LocaleSelector from '../components/editor/LocaleSelector.svelte'
  import ConfirmDialog from '../components/shared/ConfirmDialog.svelte'
  import type { PreflightWarning } from '$shared/types/models'

  const RELEASE_NOTES_LIMIT = 500

  const route = $derived(getRoute())
  const appPath = $derived(route.screen === 'release-notes' ? route.appPath : '')

  const store = releaseNotesStore

  // Dialog state
  let showAddVersionPrompt = $state(false)
  let showDuplicateVersionPrompt = $state(false)
  let showRenameVersionPrompt = $state(false)
  let showDeleteVersionConfirm = $state(false)
  let showAddLanguage = $state(false)
  let showDuplicateLanguage = $state(false)
  let showDeleteLanguageConfirm = $state(false)
  let showGenerateDialog = $state(false)

  let promptInput = $state('')
  let targetLocale = $state<string | null>(null)
  let generateOutput = $state('')
  let generateWarnings = $state<PreflightWarning[]>([])

  const existingLocales = $derived(store.entries.map((e) => e.locale))

  $effect(() => {
    if (appPath) {
      store.load(appPath)
    }
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

  // --- Language actions ---
  function handleAddLanguage(localeTag: string): void {
    showAddLanguage = false
    store.addLanguage(localeTag)
  }

  function openDuplicateLanguage(locale: string): void {
    targetLocale = locale
    showDuplicateLanguage = true
  }

  function handleDuplicateLanguage(targetTag: string): void {
    showDuplicateLanguage = false
    if (targetLocale) {
      store.duplicateLanguage(targetLocale, targetTag)
    }
    targetLocale = null
  }

  function openDeleteLanguage(locale: string): void {
    targetLocale = locale
    showDeleteLanguageConfirm = true
  }

  function confirmDeleteLanguage(): void {
    showDeleteLanguageConfirm = false
    if (targetLocale) {
      store.deleteLanguage(targetLocale)
    }
    targetLocale = null
  }

  function handleInput(locale: string, text: string): void {
    store.updateEntryText(locale, text)
  }

  function handleSave(locale: string, text: string): void {
    store.saveLanguageText(locale, text)
  }

  // --- Generate ---
  async function handleGenerate(): Promise<void> {
    const result = await store.generateOutput()
    generateOutput = result.output
    generateWarnings = result.warnings
    showGenerateDialog = true
  }

  function handlePromptKeydown(e: KeyboardEvent, confirmFn: () => void): void {
    if (e.key === 'Enter') {
      e.preventDefault()
      confirmFn()
    }
  }
</script>

<main class="release-notes-page">
  {#if store.loading && !store.config}
    <p class="status">Loading...</p>
  {:else if store.error && !store.config}
    <div class="error-banner">{store.error}</div>
  {:else if store.config && store.config.versionOrder.length === 0}
    <div class="empty-state">
      <p>No release note versions yet.</p>
      <button class="btn btn-primary" onclick={openAddVersion}>
        Create First Version
      </button>
    </div>
  {:else}
    <VersionSelector
      versions={store.config?.versionOrder ?? []}
      activeVersion={store.activeVersionName}
      onselect={(name) => store.loadVersionEntries(name)}
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
        <button class="btn btn-secondary" onclick={() => (showAddLanguage = true)}>
          + Add Language
        </button>
        <button class="btn btn-primary" onclick={handleGenerate}>
          Generate Output
        </button>
      </div>

      <LanguageList
        entries={store.entries}
        maxLength={RELEASE_NOTES_LIMIT}
        oninput={handleInput}
        onsave={handleSave}
        onduplicate={openDuplicateLanguage}
        ondelete={openDeleteLanguage}
      />
    </div>
  {/if}
</main>

<!-- Version Prompt Dialogs -->
{#if showAddVersionPrompt}
  <div class="prompt-overlay" onclick={() => (showAddVersionPrompt = false)} role="presentation">
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="prompt-dialog" onclick={(e) => e.stopPropagation()} onkeydown={() => {}} role="dialog">
      <h3>New Version</h3>
      <input
        type="text"
        bind:value={promptInput}
        placeholder="Version name (e.g., v2.0 Holiday)"
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

<!-- Language Dialogs -->
<LocaleSelector
  open={showAddLanguage}
  title="Add Language"
  excludeLocales={existingLocales}
  onselect={handleAddLanguage}
  oncancel={() => (showAddLanguage = false)}
/>

<LocaleSelector
  open={showDuplicateLanguage}
  title={`Duplicate from ${targetLocale ?? ''}`}
  excludeLocales={existingLocales}
  onselect={handleDuplicateLanguage}
  oncancel={() => { showDuplicateLanguage = false; targetLocale = null }}
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
  open={showDeleteLanguageConfirm}
  title="Delete Language"
  message={`Are you sure you want to delete the release notes for "${targetLocale}"? This will move the file to the trash.`}
  confirmLabel="Delete"
  confirmDanger={true}
  onconfirm={confirmDeleteLanguage}
  oncancel={() => { showDeleteLanguageConfirm = false; targetLocale = null }}
/>

<GenerateDialog
  open={showGenerateDialog}
  output={generateOutput}
  warnings={generateWarnings}
  onclose={() => (showGenerateDialog = false)}
/>

<style>
  .release-notes-page {
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
    max-width: 800px;
    margin: 0 auto;
    width: 100%;
  }

  .toolbar {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
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
