<script lang="ts">
  import type { AppDetails } from '$shared/types/models'
  import { LOCALE_OPTIONS, LOCALE_NAMES } from '$lib/locale-names'

  interface Props {
    details: AppDetails
    onsave: (details: AppDetails) => void
  }
  let { details, onsave }: Props = $props()

  let defaultLanguage = $state('')
  let contactEmail = $state('')
  let contactWebsite = $state('')
  let contactPhone = $state('')
  let privacyPolicyUrl = $state('')
  let saving = $state(false)

  let langSearch = $state('')
  let langDropdownOpen = $state(false)
  let langInputEl: HTMLInputElement | undefined = $state()

  const langDisplayValue = $derived(
    langDropdownOpen ? langSearch : (LOCALE_NAMES[defaultLanguage] ? `${LOCALE_NAMES[defaultLanguage]} (${defaultLanguage})` : defaultLanguage)
  )

  const filteredLocales = $derived(
    langSearch
      ? LOCALE_OPTIONS.filter(
          (l) =>
            l.name.toLowerCase().includes(langSearch.toLowerCase()) ||
            l.tag.toLowerCase().includes(langSearch.toLowerCase())
        )
      : LOCALE_OPTIONS
  )

  function openLangDropdown(): void {
    langSearch = ''
    langDropdownOpen = true
  }

  function selectLocale(tag: string): void {
    defaultLanguage = tag
    langDropdownOpen = false
    langSearch = ''
  }

  function handleLangBlur(): void {
    // Delay to allow click on dropdown item
    setTimeout(() => {
      langDropdownOpen = false
      langSearch = ''
    }, 150)
  }

  // Sync local state when prop changes
  $effect(() => {
    defaultLanguage = details.defaultLanguage
    contactEmail = details.contactEmail
    contactWebsite = details.contactWebsite
    contactPhone = details.contactPhone
    privacyPolicyUrl = details.privacyPolicyUrl
  })

  const isDirty = $derived(
    defaultLanguage !== details.defaultLanguage ||
    contactEmail !== details.contactEmail ||
    contactWebsite !== details.contactWebsite ||
    contactPhone !== details.contactPhone ||
    privacyPolicyUrl !== details.privacyPolicyUrl
  )

  async function handleSave(): Promise<void> {
    saving = true
    onsave({
      defaultLanguage: defaultLanguage.trim(),
      contactEmail: contactEmail.trim(),
      contactWebsite: contactWebsite.trim(),
      contactPhone: contactPhone.trim(),
      privacyPolicyUrl: privacyPolicyUrl.trim()
    })
    saving = false
  }
</script>

<form class="details-form" onsubmit={(e) => { e.preventDefault(); handleSave() }}>
  <div class="field">
    <span class="label">Default Language</span>
    <div class="locale-picker">
      <input
        bind:this={langInputEl}
        type="text"
        value={langDisplayValue}
        oninput={(e) => { langSearch = (e.target as HTMLInputElement).value }}
        onfocus={openLangDropdown}
        onblur={handleLangBlur}
        placeholder="Search language..."
        disabled={saving}
      />
      {#if langDropdownOpen}
        <ul class="locale-dropdown">
          {#each filteredLocales as locale (locale.tag)}
            <li>
              <button
                class="locale-option"
                class:selected={locale.tag === defaultLanguage}
                onmousedown={(e) => { e.preventDefault(); selectLocale(locale.tag) }}
              >
                <span class="locale-name">{locale.name}</span>
                <span class="locale-tag">{locale.tag}</span>
              </button>
            </li>
          {:else}
            <li class="no-results">No matching languages</li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>

  <label class="field">
    <span class="label">Contact Email</span>
    <input type="email" bind:value={contactEmail} placeholder="contact@example.com" disabled={saving} />
  </label>

  <label class="field">
    <span class="label">Contact Website</span>
    <input type="url" bind:value={contactWebsite} placeholder="https://example.com" disabled={saving} />
  </label>

  <label class="field">
    <span class="label">Contact Phone</span>
    <input type="tel" bind:value={contactPhone} placeholder="+1-555-000-0000" disabled={saving} />
  </label>

  <label class="field">
    <span class="label">Privacy Policy URL</span>
    <input type="url" bind:value={privacyPolicyUrl} placeholder="https://example.com/privacy" disabled={saving} />
  </label>

  <button type="submit" class="btn-save" disabled={!isDirty || saving}>
    {saving ? 'Saving...' : 'Save Details'}
  </button>
</form>

<style>
  .details-form {
    display: flex;
    flex-direction: column;
    gap: 14px;
    max-width: 500px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
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

  .locale-picker {
    position: relative;
  }

  .locale-picker input {
    width: 100%;
    box-sizing: border-box;
  }

  .locale-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    max-height: 200px;
    overflow-y: auto;
    background: #fff;
    border: 1px solid #ddd;
    border-top: none;
    border-radius: 0 0 6px 6px;
    list-style: none;
    margin: 0;
    padding: 0;
    z-index: 20;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .locale-option {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 8px 12px;
    border: none;
    background: none;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.8125rem;
    color: #333;
    text-align: left;
  }

  .locale-option:hover {
    background: #f0f7ff;
  }

  .locale-option.selected {
    background: #e8f0fe;
    font-weight: 500;
  }

  .locale-name {
    flex: 1;
  }

  .locale-tag {
    font-size: 0.75rem;
    color: #888;
    font-family: 'SF Mono', 'Fira Code', monospace;
    margin-left: 12px;
  }

  .no-results {
    padding: 8px 12px;
    font-size: 0.8125rem;
    color: #888;
  }

  .btn-save {
    align-self: flex-start;
    padding: 8px 20px;
    font-size: 0.875rem;
    font-family: inherit;
    background: #0066cc;
    border: none;
    border-radius: 6px;
    color: #fff;
    cursor: pointer;
    margin-top: 4px;
  }

  .btn-save:hover:not(:disabled) {
    background: #0055aa;
  }

  .btn-save:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
