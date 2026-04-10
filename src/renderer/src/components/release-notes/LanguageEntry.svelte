<script lang="ts">
  import { LOCALE_NAMES } from '$lib/locale-names'

  interface Props {
    locale: string
    text: string
    maxLength: number
    oninput: (locale: string, text: string) => void
    onsave: (locale: string, text: string) => void
    onduplicate: (locale: string) => void
    ondelete: (locale: string) => void
  }

  let { locale, text, maxLength, oninput, onsave, onduplicate, ondelete }: Props = $props()

  let saveTimer: ReturnType<typeof setTimeout> | null = null

  const localeName = $derived(LOCALE_NAMES[locale] || locale)
  const charCount = $derived(text.length)
  const countClass = $derived(
    charCount > maxLength ? 'over' : charCount >= maxLength * 0.9 ? 'warn' : ''
  )

  function handleInput(e: Event): void {
    const target = e.target as HTMLTextAreaElement
    oninput(locale, target.value)

    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      onsave(locale, target.value)
    }, 500)
  }

  function handleBlur(): void {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    onsave(locale, text)
  }
</script>

<div class="entry">
  <div class="entry-header">
    <div class="locale-info">
      <span class="locale-name">{localeName}</span>
      <span class="locale-tag">{locale}</span>
    </div>
    <div class="entry-actions">
      <button
        class="action-btn"
        onclick={() => onduplicate(locale)}
        title="Duplicate to another language"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="5" y="5" width="9" height="9" rx="1.5" />
          <path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" />
        </svg>
      </button>
      <button
        class="action-btn danger"
        onclick={() => ondelete(locale)}
        title="Delete language"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M2 4h12M5.3 4V2.7a.7.7 0 01.7-.7h4a.7.7 0 01.7.7V4M6.5 7v4M9.5 7v4" />
          <path d="M3.5 4l.7 9.3a1 1 0 001 .7h5.6a1 1 0 001-.7L12.5 4" />
        </svg>
      </button>
    </div>
  </div>
  <textarea
    class="note-input"
    value={text}
    oninput={handleInput}
    onblur={handleBlur}
    placeholder="Enter release notes for {locale}..."
    rows="4"
  ></textarea>
  <div class="char-count {countClass}">
    {charCount}/{maxLength}
  </div>
</div>

<style>
  .entry {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 12px 16px;
    background: #fff;
  }

  .entry-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .locale-info {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .locale-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1a1a1a;
  }

  .locale-tag {
    font-size: 0.75rem;
    color: #888;
    font-family: 'SF Mono', 'Fira Code', monospace;
  }

  .entry-actions {
    display: flex;
    gap: 4px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: none;
    color: #555;
    cursor: pointer;
  }

  .action-btn:hover {
    background: #f0f0f0;
    color: #1a1a1a;
  }

  .action-btn.danger:hover {
    background: #fff0f0;
    color: #d32f2f;
  }

  .note-input {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    resize: vertical;
    outline: none;
    box-sizing: border-box;
    line-height: 1.5;
  }

  .note-input:focus {
    border-color: #0066cc;
    box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.1);
  }

  .char-count {
    text-align: right;
    font-size: 0.75rem;
    color: #888;
    margin-top: 4px;
  }

  .char-count.warn {
    color: #e67e22;
  }

  .char-count.over {
    color: #d32f2f;
    font-weight: 600;
  }
</style>
