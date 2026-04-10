<script lang="ts">
  import { getRoute } from '../router.svelte'
  import { editorStore, TEXT_FILE_MAP, SCREENSHOT_LABELS, SCREENSHOT_TYPES } from '../stores/editor.svelte'
  import LocaleTabs from '../components/editor/LocaleTabs.svelte'
  import TextEditor from '../components/editor/TextEditor.svelte'
  import ImageGrid from '../components/editor/ImageGrid.svelte'
  import ScreenshotSection from '../components/editor/ScreenshotSection.svelte'
  import LocaleSelector from '../components/editor/LocaleSelector.svelte'
  import ConfirmDialog from '../components/shared/ConfirmDialog.svelte'
  import ScreenshotPicker from '../components/editor/ScreenshotPicker.svelte'
  import type { ScreenshotType } from '$shared/types/models'

  const route = $derived(getRoute())
  const appPath = $derived(route.screen === 'editor' ? route.appPath : '')
  const versionDir = $derived(route.screen === 'editor' ? route.versionDir : '')

  let showAddLocale = $state(false)
  let showDuplicateLocale = $state(false)
  let showDeleteLocaleConfirm = $state(false)
  let showScreenshotPicker = $state(false)
  let pickerScreenshotType = $state<ScreenshotType | null>(null)

  $effect(() => {
    if (appPath && versionDir) {
      editorStore.load(appPath, versionDir)
    }
  })

  // Listen for menu:add-localization action from menu bar
  $effect(() => {
    function handleMenuAddLocale(): void {
      showAddLocale = true
    }
    window.addEventListener('menu:add-localization', handleMenuAddLocale)
    return () => window.removeEventListener('menu:add-localization', handleMenuAddLocale)
  })

  function handleTextInput(key: string, value: string): void {
    editorStore.texts = { ...editorStore.texts, [key]: value }
  }

  async function handleAddLocale(tag: string): Promise<void> {
    showAddLocale = false
    await editorStore.addLocale(tag)
  }

  async function handleDuplicateLocale(tag: string): Promise<void> {
    showDuplicateLocale = false
    if (editorStore.activeLocale) {
      await editorStore.duplicateLocale(editorStore.activeLocale, tag)
    }
  }

  async function handleDeleteLocale(): Promise<void> {
    showDeleteLocaleConfirm = false
    if (editorStore.activeLocale) {
      await editorStore.deleteLocale(editorStore.activeLocale)
    }
  }

  function getScreenshotGroup(type: ScreenshotType) {
    return editorStore.screenshotGroups.find((g) => g.type === type) ?? {
      type,
      dirPath: '',
      screenshots: []
    }
  }

  function getTextError(key: string): string | null {
    return editorStore.localeErrors[key] ?? null
  }

  function getImageErrors(): Record<string, string> {
    const errors: Record<string, string> = {}
    for (const [field, msg] of Object.entries(editorStore.localeErrors)) {
      if (field.endsWith('.png') && !field.includes('/')) {
        errors[field] = msg
      }
    }
    return errors
  }

  function getScreenshotError(type: ScreenshotType): string | null {
    return editorStore.localeErrors[`${type} screenshots`] ?? null
  }
</script>

<main class="editor-page">
  {#if editorStore.loading && editorStore.locales.length === 0}
    <p class="status">Loading...</p>
  {:else if editorStore.error && editorStore.locales.length === 0}
    <div class="error-banner">{editorStore.error}</div>
  {:else if editorStore.locales.length === 0}
    <div class="empty-state">
      <p>No localizations yet.</p>
      <button class="btn btn-primary" onclick={() => (showAddLocale = true)}>
        Add Localization
      </button>
    </div>
  {:else}
    <LocaleTabs
      locales={editorStore.locales}
      activeLocale={editorStore.activeLocale}
      isDirty={editorStore.isDirty}
      onswitch={(locale) => editorStore.switchLocale(locale)}
      onadd={() => (showAddLocale = true)}
      onduplicate={() => (showDuplicateLocale = true)}
      ondelete={() => (showDeleteLocaleConfirm = true)}
    />

    {#if editorStore.error}
      <div class="error-banner">{editorStore.error}</div>
    {/if}

    <div class="editor-content">
      <!-- Text Fields -->
      <section class="section">
        <h2 class="section-title">Text Fields</h2>
        <div class="text-fields">
          {#each TEXT_FILE_MAP as field (field.key)}
            <TextEditor
              label={field.key === 'title' ? 'Title' : field.key === 'shortDescription' ? 'Short Description' : field.key === 'fullDescription' ? 'Full Description' : 'Video URL'}
              value={editorStore.texts[field.key]}
              maxLength={field.maxLength}
              multiline={field.key === 'fullDescription'}
              placeholder={field.key === 'videoUrl' ? 'https://...' : ''}
              error={getTextError(field.key)}
              oninput={(v) => handleTextInput(field.key, v)}
            />
          {/each}
        </div>

        <div class="save-row">
          <button
            class="btn btn-primary"
            disabled={!editorStore.isDirty || editorStore.saving}
            onclick={() => editorStore.saveTexts()}
          >
            {editorStore.saving ? 'Saving...' : 'Save'}
          </button>
          <button
            class="btn btn-secondary"
            disabled={editorStore.validating}
            onclick={() => editorStore.validateVersion()}
          >
            {editorStore.validating ? 'Validating...' : 'Validate'}
          </button>
          {#if editorStore.isDirty}
            <span class="dirty-hint">Unsaved changes (Ctrl+S)</span>
          {/if}
        </div>

        {#if editorStore.validationReport}
          <div class="validation-summary" class:valid={editorStore.validationReport.valid}>
            {#if editorStore.validationReport.valid}
              <span class="validation-pass">All checks passed</span>
            {:else}
              <span class="validation-fail">
                {editorStore.validationReport.errors.length} error{editorStore.validationReport.errors.length !== 1 ? 's' : ''}
              </span>
            {/if}
            {#if editorStore.validationReport.warnings.length > 0}
              <span class="validation-warn">
                {editorStore.validationReport.warnings.length} warning{editorStore.validationReport.warnings.length !== 1 ? 's' : ''}
              </span>
            {/if}
          </div>
        {/if}
      </section>

      <!-- Images -->
      {#if editorStore.localePath}
        <section class="section">
          <h2 class="section-title">Images</h2>
          <ImageGrid
            images={editorStore.images}
            localePath={editorStore.localePath}
            imageTimestamp={editorStore.imageTimestamp}
            imageErrors={getImageErrors()}
            onaddimage={(key, path) => editorStore.addImage(key, path)}
            ondeleteimage={(key) => editorStore.deleteImage(key)}
            onpasteimage={(key, b64) => editorStore.addImageFromClipboard(key, b64)}
          />
        </section>
      {/if}

      <!-- Screenshots -->
      <section class="section">
        <h2 class="section-title">Screenshots</h2>
        <div class="screenshot-sections">
          {#each SCREENSHOT_TYPES as type (type)}
            <ScreenshotSection
              group={getScreenshotGroup(type)}
              typeLabel={SCREENSHOT_LABELS[type]}
              maxCount={8}
              imageTimestamp={editorStore.imageTimestamp}
              validationError={getScreenshotError(type)}
              onadd={(path) => editorStore.addScreenshot(type, path)}
              onpaste={(b64) => editorStore.addScreenshotFromClipboard(type, b64)}
              ondelete={(fn) => editorStore.deleteScreenshot(type, fn)}
              onreorder={(order) => editorStore.reorderScreenshots(type, order)}
              onpickfromlibrary={() => {
                pickerScreenshotType = type
                showScreenshotPicker = true
              }}
            />
          {/each}
        </div>
      </section>
    </div>
  {/if}
</main>

<!-- Dialogs -->
<LocaleSelector
  open={showAddLocale}
  title="Add Localization"
  excludeLocales={editorStore.locales}
  onselect={handleAddLocale}
  oncancel={() => (showAddLocale = false)}
/>

<LocaleSelector
  open={showDuplicateLocale}
  title="Duplicate to..."
  excludeLocales={editorStore.locales}
  onselect={handleDuplicateLocale}
  oncancel={() => (showDuplicateLocale = false)}
/>

<ConfirmDialog
  open={showDeleteLocaleConfirm}
  title="Delete Localization"
  message={`Are you sure you want to delete the "${editorStore.activeLocale}" localization? This will move it to the trash.`}
  confirmLabel="Delete"
  confirmDanger={true}
  onconfirm={handleDeleteLocale}
  oncancel={() => (showDeleteLocaleConfirm = false)}
/>

<ScreenshotPicker
  open={showScreenshotPicker}
  appPath={appPath}
  imageTimestamp={editorStore.imageTimestamp}
  onpick={(filePath) => {
    showScreenshotPicker = false
    if (pickerScreenshotType) {
      editorStore.addScreenshot(pickerScreenshotType, filePath)
    }
  }}
  oncancel={() => (showScreenshotPicker = false)}
/>

<style>
  .editor-page {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 48px);
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

  .editor-content {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
    width: 100%;
  }

  .section {
    margin-bottom: 28px;
  }

  .section-title {
    font-size: 1rem;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0 0 14px;
  }

  .text-fields {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .save-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 14px;
  }

  .dirty-hint {
    font-size: 0.75rem;
    color: #e68a00;
  }

  .screenshot-sections {
    display: flex;
    flex-direction: column;
    gap: 14px;
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
  }

  .btn-secondary:hover:not(:disabled) {
    background: #e0e0e0;
  }

  .validation-summary {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 0.8125rem;
    margin-top: 8px;
    background: #fef2f2;
  }

  .validation-summary.valid {
    background: #f0fdf4;
  }

  .validation-pass {
    color: #2e7d32;
    font-weight: 500;
  }

  .validation-fail {
    color: #d32f2f;
    font-weight: 500;
  }

  .validation-warn {
    color: #e68a00;
  }
</style>
