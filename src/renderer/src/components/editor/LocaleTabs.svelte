<script lang="ts">
  import { LOCALE_NAMES } from '$lib/locale-names'

  interface Props {
    locales: string[]
    activeLocale: string | null
    isDirty: boolean
    onswitch: (locale: string) => void
    onadd: () => void
    onduplicate: () => void
    ondelete: () => void
  }

  let { locales, activeLocale, isDirty, onswitch, onadd, onduplicate, ondelete }: Props = $props()

  function getLocaleName(tag: string): string {
    return LOCALE_NAMES[tag] || tag
  }
</script>

<div class="locale-tabs-bar">
  <div class="tabs-scroll">
    {#each locales as locale (locale)}
      <button
        class="tab"
        class:active={locale === activeLocale}
        onclick={() => onswitch(locale)}
      >
        <span class="tab-name">{getLocaleName(locale)}</span>
        <span class="tab-tag">{locale}</span>
        {#if locale === activeLocale && isDirty}
          <span class="dirty-dot" title="Unsaved changes"></span>
        {/if}
      </button>
    {/each}
  </div>

  <div class="tab-actions">
    <button class="action-btn" onclick={onadd} title="Add Localization">+</button>
    <button
      class="action-btn"
      onclick={onduplicate}
      title="Duplicate Localization"
      disabled={!activeLocale}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="5" y="5" width="9" height="9" rx="1.5" />
        <path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" />
      </svg>
    </button>
    <button
      class="action-btn danger"
      onclick={ondelete}
      title="Delete Localization"
      disabled={!activeLocale || locales.length <= 1}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M2 4h12M5.3 4V2.7a.7.7 0 01.7-.7h4a.7.7 0 01.7.7V4M6.5 7v4M9.5 7v4" />
        <path d="M3.5 4l.7 9.3a1 1 0 001 .7h5.6a1 1 0 001-.7L12.5 4" />
      </svg>
    </button>
  </div>
</div>

<style>
  .locale-tabs-bar {
    display: flex;
    align-items: stretch;
    border-bottom: 1px solid #e0e0e0;
    background: #fff;
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .tabs-scroll {
    display: flex;
    overflow-x: auto;
    flex: 1;
    gap: 0;
  }

  .tabs-scroll::-webkit-scrollbar {
    height: 3px;
  }

  .tabs-scroll::-webkit-scrollbar-thumb {
    background: #ccc;
    border-radius: 2px;
  }

  .tab {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 8px 16px;
    border: none;
    border-bottom: 2px solid transparent;
    background: none;
    cursor: pointer;
    font-family: inherit;
    white-space: nowrap;
    flex-shrink: 0;
    color: #555;
    transition: color 0.15s, border-color 0.15s;
  }

  .tab:hover {
    background: #f8f8f8;
    color: #1a1a1a;
  }

  .tab.active {
    color: #0066cc;
    border-bottom-color: #0066cc;
    font-weight: 500;
  }

  .tab-name {
    font-size: 0.8125rem;
    line-height: 1.2;
  }

  .tab-tag {
    font-size: 0.625rem;
    color: #aaa;
    font-family: 'SF Mono', 'Fira Code', monospace;
  }

  .tab.active .tab-tag {
    color: #6699cc;
  }

  .dirty-dot {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #e68a00;
  }

  .tab-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 12px;
    border-left: 1px solid #e0e0e0;
    flex-shrink: 0;
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
    font-size: 1.125rem;
    font-family: inherit;
    line-height: 1;
  }

  .action-btn:hover:not(:disabled) {
    background: #f0f0f0;
    color: #1a1a1a;
  }

  .action-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .action-btn.danger:hover:not(:disabled) {
    background: #fff0f0;
    color: #d32f2f;
  }
</style>
