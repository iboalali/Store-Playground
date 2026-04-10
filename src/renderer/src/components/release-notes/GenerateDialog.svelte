<script lang="ts">
  import type { PreflightWarning } from '$shared/types/models'

  interface Props {
    open: boolean
    output: string
    warnings: PreflightWarning[]
    onclose: () => void
  }

  let { open, output, warnings, onclose }: Props = $props()

  let dialogEl: HTMLDialogElement | undefined = $state()
  let copied = $state(false)
  let warningsExpanded = $state(true)

  const hasWarnings = $derived(warnings.length > 0)

  $effect(() => {
    if (open && dialogEl && !dialogEl.open) {
      copied = false
      warningsExpanded = warnings.length > 0
      dialogEl.showModal()
    } else if (!open && dialogEl?.open) {
      dialogEl.close()
    }
  })

  async function copyToClipboard(): Promise<void> {
    try {
      await navigator.clipboard.writeText(output)
      copied = true
      setTimeout(() => {
        copied = false
      }, 2000)
    } catch {
      // Fallback: select all text in the textarea
    }
  }
</script>

<dialog bind:this={dialogEl} onclose={onclose}>
  <h2>Generated Release Notes</h2>

  <!-- Preflight section -->
  {#if hasWarnings}
    <div class="preflight">
      <button class="preflight-toggle" onclick={() => (warningsExpanded = !warningsExpanded)}>
        <span class="preflight-icon warning">&#9888;</span>
        <span>{warnings.length} warning{warnings.length !== 1 ? 's' : ''}</span>
        <span class="toggle-arrow">{warningsExpanded ? '&#9660;' : '&#9654;'}</span>
      </button>
      {#if warningsExpanded}
        <ul class="warning-list">
          {#each warnings as w}
            <li class="warning-item {w.severity}">
              <span class="warning-locale">{w.locale}</span>: {w.message}
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {:else}
    <div class="preflight success">
      <span class="preflight-icon success">&#10003;</span>
      <span>All checks passed</span>
    </div>
  {/if}

  <!-- Output section -->
  <textarea class="output-area" readonly rows="16">{output}</textarea>

  <!-- Actions -->
  <div class="actions">
    <button type="button" class="btn-cancel" onclick={onclose}>Close</button>
    <button type="button" class="btn-copy" onclick={copyToClipboard} disabled={!output}>
      {copied ? 'Copied!' : 'Copy to Clipboard'}
    </button>
  </div>
</dialog>

<style>
  dialog {
    border: none;
    border-radius: 12px;
    padding: 24px;
    width: 600px;
    max-width: 90vw;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
    font-family: inherit;
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

  .preflight {
    margin-bottom: 12px;
    border-radius: 6px;
    font-size: 0.8125rem;
  }

  .preflight.success {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: #f0fdf4;
    color: #16a34a;
  }

  .preflight-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 8px 12px;
    background: #fffbeb;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.8125rem;
    color: #92400e;
    text-align: left;
  }

  .preflight-toggle:hover {
    background: #fef3c7;
  }

  .preflight-icon {
    font-size: 1rem;
    line-height: 1;
  }

  .preflight-icon.warning {
    color: #f59e0b;
  }

  .preflight-icon.success {
    color: #16a34a;
    font-weight: bold;
  }

  .toggle-arrow {
    margin-left: auto;
    font-size: 0.625rem;
  }

  .warning-list {
    list-style: none;
    margin: 6px 0 0;
    padding: 8px 12px;
    background: #fffbeb;
    border-radius: 0 0 6px 6px;
    max-height: 120px;
    overflow-y: auto;
  }

  .warning-item {
    font-size: 0.75rem;
    color: #78350f;
    padding: 2px 0;
  }

  .warning-item.error {
    color: #d32f2f;
  }

  .warning-locale {
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-weight: 600;
  }

  .output-area {
    flex: 1;
    width: 100%;
    padding: 12px;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
    font-size: 0.8125rem;
    line-height: 1.5;
    resize: vertical;
    outline: none;
    background: #fafafa;
    box-sizing: border-box;
  }

  .output-area:focus {
    border-color: #0066cc;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
  }

  .btn-cancel,
  .btn-copy {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    cursor: pointer;
    border: none;
  }

  .btn-cancel {
    background: #f0f0f0;
    color: #555;
  }

  .btn-cancel:hover {
    background: #e0e0e0;
  }

  .btn-copy {
    background: #0066cc;
    color: #fff;
    min-width: 140px;
  }

  .btn-copy:hover:not(:disabled) {
    background: #0055aa;
  }

  .btn-copy:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
