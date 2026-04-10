<script lang="ts">
  import type { ReleaseNoteEntry } from '$shared/types/models'
  import LanguageEntry from './LanguageEntry.svelte'

  interface Props {
    entries: ReleaseNoteEntry[]
    maxLength: number
    oninput: (locale: string, text: string) => void
    onsave: (locale: string, text: string) => void
    onduplicate: (locale: string) => void
    ondelete: (locale: string) => void
  }

  let { entries, maxLength, oninput, onsave, onduplicate, ondelete }: Props = $props()
</script>

<div class="language-list">
  {#if entries.length === 0}
    <div class="empty-state">
      <p>No languages added yet. Click "Add Language" to get started.</p>
    </div>
  {:else}
    {#each entries as entry (entry.locale)}
      <LanguageEntry
        locale={entry.locale}
        text={entry.text}
        {maxLength}
        {oninput}
        {onsave}
        {onduplicate}
        {ondelete}
      />
    {/each}
  {/if}
</div>

<style>
  .language-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .empty-state {
    text-align: center;
    padding: 48px 24px;
    color: #888;
    font-size: 0.875rem;
  }
</style>
