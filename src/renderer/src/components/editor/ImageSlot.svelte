<script lang="ts">
  interface Props {
    label: string
    dimensions: string
    filePath: string | null
    imageTimestamp: number
    onpick: () => void
    ondelete: () => void
    onpaste: (base64Data: string) => void
  }

  let { label, dimensions, filePath, imageTimestamp, onpick, ondelete, onpaste }: Props = $props()

  const imageSrc = $derived(filePath ? `file://${filePath}?t=${imageTimestamp}` : null)

  async function handlePaste(e: ClipboardEvent): Promise<void> {
    const items = e.clipboardData?.items
    if (!items) return

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const blob = item.getAsFile()
        if (!blob) return

        const buffer = await blob.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        let binary = ''
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i])
        }
        const base64 = btoa(binary)
        onpaste(base64)
        return
      }
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="image-slot"
  class:has-image={imageSrc}
  tabindex="0"
  onpaste={handlePaste}
>
  {#if imageSrc}
    <img src={imageSrc} alt={label} class="preview" />
    <button class="delete-btn" onclick={ondelete} title="Remove image">&times;</button>
    <button class="replace-btn" onclick={onpick} title="Replace image">Replace</button>
  {:else}
    <button class="empty-slot" onclick={onpick}>
      <span class="plus">+</span>
      <span class="slot-label">{label}</span>
      <span class="slot-dims">{dimensions}</span>
      <span class="slot-hint">Click to pick or Ctrl+V to paste</span>
    </button>
  {/if}
</div>

<style>
  .image-slot {
    position: relative;
    border: 2px dashed #d0d0d0;
    border-radius: 8px;
    aspect-ratio: auto;
    min-height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background: #fafafa;
    outline: none;
  }

  .image-slot:focus {
    border-color: #0066cc;
    box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.15);
  }

  .image-slot.has-image {
    border-style: solid;
    border-color: #e0e0e0;
  }

  .preview {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }

  .delete-btn {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    font-size: 1rem;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .image-slot:hover .delete-btn {
    opacity: 1;
  }

  .replace-btn {
    position: absolute;
    bottom: 4px;
    right: 4px;
    padding: 4px 8px;
    border: none;
    border-radius: 4px;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    font-size: 0.6875rem;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s;
    font-family: inherit;
  }

  .image-slot:hover .replace-btn {
    opacity: 1;
  }

  .empty-slot {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 16px;
    border: none;
    background: none;
    cursor: pointer;
    color: #888;
    font-family: inherit;
    width: 100%;
    height: 100%;
  }

  .empty-slot:hover {
    color: #0066cc;
  }

  .plus {
    font-size: 1.5rem;
    font-weight: 300;
    line-height: 1;
  }

  .slot-label {
    font-size: 0.8125rem;
    font-weight: 500;
  }

  .slot-dims {
    font-size: 0.6875rem;
    color: #aaa;
  }

  .slot-hint {
    font-size: 0.625rem;
    color: #bbb;
    margin-top: 2px;
  }
</style>
