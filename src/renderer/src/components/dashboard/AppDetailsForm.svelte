<script lang="ts">
  import type { AppDetails } from '$shared/types/models'

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
  <label class="field">
    <span class="label">Default Language</span>
    <input type="text" bind:value={defaultLanguage} placeholder="en-US" disabled={saving} />
  </label>

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
