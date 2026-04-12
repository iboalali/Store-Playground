<script lang="ts">
  import { LOCALE_OPTIONS } from '$lib/locale-names'

  interface Props {
    open: boolean
    title: string
    excludeLocales: string[]
    onselect: (localeTag: string) => void
    oncancel: () => void
  }

  let { open, title, excludeLocales, onselect, oncancel }: Props = $props()

  let dialogEl: HTMLDialogElement | undefined = $state()
  let search = $state('')

  const excludeSet = $derived(new Set(excludeLocales))

  const filteredOptions = $derived(
    LOCALE_OPTIONS.filter((opt) => {
      if (!search) return true
      const q = search.toLowerCase()
      return opt.name.toLowerCase().includes(q) || opt.tag.toLowerCase().includes(q)
    })
  )

  $effect(() => {
    if (open && dialogEl && !dialogEl.open) {
      search = ''
      dialogEl.showModal()
    } else if (!open && dialogEl?.open) {
      dialogEl.close()
    }
  })

  function handleSelect(tag: string): void {
    if (excludeSet.has(tag)) return
    onselect(tag)
  }
</script>

<dialog bind:this={dialogEl} onclose={oncancel}>
  <h2>{title}</h2>

  <input
    type="text"
    class="search-input"
    placeholder="Search locales..."
    bind:value={search}
  />

  <div class="locale-list">
    {#each filteredOptions as opt (opt.tag)}
      <button
        class="locale-item"
        class:disabled={excludeSet.has(opt.tag)}
        disabled={excludeSet.has(opt.tag)}
        onclick={() => handleSelect(opt.tag)}
      >
        <span class="locale-name">{opt.name}</span>
        <span class="locale-tag">{opt.tag}</span>
      </button>
    {/each}

    {#if filteredOptions.length === 0}
      <p class="no-results">No locales match your search.</p>
    {/if}
  </div>

  <div class="actions">
    <button type="button" class="btn-cancel" onclick={oncancel}>Cancel</button>
  </div>
</dialog>

<style>
  dialog {
    border: none;
    border-radius: 12px;
    padding: 24px;
    width: 420px;
    max-width: 90vw;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
    font-family: inherit;
    margin: auto;
  }

  dialog::backdrop {
    background: rgba(0, 0, 0, 0.4);
  }

  h2 {
    margin: 0 0 16px;
    font-size: 1.125rem;
    font-weight: 600;
    color: #1a1a1a;
  }

  .search-input {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    outline: none;
    margin-bottom: 12px;
  }

  .search-input:focus {
    border-color: #0066cc;
  }

  .locale-list {
    flex: 1;
    overflow-y: auto;
    max-height: 400px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .locale-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 10px;
    border: none;
    border-radius: 6px;
    background: none;
    cursor: pointer;
    font-family: inherit;
    text-align: left;
  }

  .locale-item:hover:not(.disabled) {
    background: #f0f0f0;
  }

  .locale-item.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .locale-name {
    font-size: 0.875rem;
    color: #1a1a1a;
  }

  .locale-tag {
    font-size: 0.75rem;
    color: #888;
    font-family: 'SF Mono', 'Fira Code', monospace;
  }

  .no-results {
    padding: 16px;
    text-align: center;
    font-size: 0.875rem;
    color: #888;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 16px;
  }

  .btn-cancel {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    cursor: pointer;
    border: none;
    background: #f0f0f0;
    color: #555;
  }

  .btn-cancel:hover {
    background: #e0e0e0;
  }
</style>
