<script lang="ts">
  interface Props {
    label: string
    value: string
    maxLength: number
    multiline?: boolean
    placeholder?: string
    error?: string | null
    oninput: (value: string) => void
  }

  let {
    label,
    value,
    maxLength,
    multiline = false,
    placeholder = '',
    error = null,
    oninput
  }: Props = $props()

  const charCount = $derived(value.length)
  const isOverLimit = $derived(maxLength > 0 && charCount > maxLength)
  const isNearLimit = $derived(maxLength > 0 && charCount >= maxLength * 0.9 && !isOverLimit)
  const hasError = $derived(!!error || isOverLimit)

  function handleInput(e: Event): void {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement
    oninput(target.value)
  }
</script>

<div class="text-editor">
  <div class="label-row">
    <span class="label">{label}</span>
    {#if maxLength > 0}
      <span
        class="char-count"
        class:near={isNearLimit}
        class:over={isOverLimit}
      >
        {charCount}/{maxLength}
      </span>
    {/if}
  </div>

  {#if multiline}
    <textarea
      class="input textarea"
      class:over-limit={hasError}
      rows={8}
      {placeholder}
      {value}
      aria-label={label}
      oninput={handleInput}
    ></textarea>
  {:else}
    <input
      type="text"
      class="input"
      class:over-limit={hasError}
      {placeholder}
      {value}
      aria-label={label}
      oninput={handleInput}
    />
  {/if}

  {#if error}
    <span class="validation-error">{error}</span>
  {/if}
</div>

<style>
  .text-editor {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: #555;
  }

  .char-count {
    font-size: 0.75rem;
    color: #888;
    font-variant-numeric: tabular-nums;
  }

  .char-count.near {
    color: #e68a00;
  }

  .char-count.over {
    color: #d32f2f;
    font-weight: 600;
  }

  .input {
    width: 100%;
    padding: 8px 10px;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
    color: #1a1a1a;
    background: #fff;
    outline: none;
    transition: border-color 0.15s;
  }

  .input:focus {
    border-color: #0066cc;
  }

  .input.over-limit {
    border-color: #d32f2f;
  }

  .textarea {
    resize: vertical;
    min-height: 120px;
    line-height: 1.5;
  }

  .validation-error {
    font-size: 0.75rem;
    color: #d32f2f;
    margin-top: 2px;
  }
</style>
