<script lang="ts">
  import { ipc } from '$lib/ipc'
  import type { VariantData } from '$shared/types/models'

  interface Props {
    variant: VariantData
    screenSlug: string
    imageTimestamp: number
    onsetimage: (sourcePath: string) => void
    onsetimagedata: (base64Data: string) => void
    onclear: () => void
    ondragstart: (e: DragEvent) => void
    ondrop: (sourceScreenSlug: string, sourceVariantSlug: string) => void
    onexternaldrop: (filePath: string) => void
  }

  let {
    variant,
    screenSlug,
    imageTimestamp,
    onsetimage,
    onsetimagedata,
    onclear,
    ondragstart,
    ondrop,
    onexternaldrop
  }: Props = $props()

  let dragOver = $state(false)

  async function handlePick(): Promise<void> {
    const path = await ipc.openFileDialog({
      title: `Set ${variant.displayName} Image`,
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }]
    })
    if (path) {
      onsetimage(path)
    }
  }

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
        onsetimagedata(btoa(binary))
        return
      }
    }
  }

  function handleDragStart(e: DragEvent): void {
    if (!variant.hasImage || !e.dataTransfer) return
    e.dataTransfer.setData(
      'text/x-variant',
      JSON.stringify({ screenSlug, variantSlug: variant.slug })
    )
    e.dataTransfer.effectAllowed = 'move'
    ondragstart(e)
  }

  function handleDragOver(e: DragEvent): void {
    e.preventDefault()
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move'
    }
    dragOver = true
  }

  function handleDragLeave(): void {
    dragOver = false
  }

  function handleDrop(e: DragEvent): void {
    e.preventDefault()
    dragOver = false

    if (!e.dataTransfer) return

    // Check for external file drop
    if (e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      if (/\.(png|jpg|jpeg)$/i.test(file.name)) {
        // Electron provides .path on File objects
        const filePath = (file as File & { path?: string }).path
        if (filePath) {
          onexternaldrop(filePath)
          return
        }
      }
    }

    // Check for internal variant drag
    const variantData = e.dataTransfer.getData('text/x-variant')
    if (variantData) {
      try {
        const { screenSlug: srcScreen, variantSlug: srcVariant } = JSON.parse(variantData)
        if (srcScreen !== screenSlug || srcVariant !== variant.slug) {
          ondrop(srcScreen, srcVariant)
        }
      } catch {
        // Ignore parse errors
      }
    }
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  class="variant-slot"
  class:has-image={variant.hasImage}
  class:drag-over={dragOver}
  draggable={variant.hasImage ? 'true' : 'false'}
  ondragstart={handleDragStart}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
  tabindex="0"
  onpaste={handlePaste}
  role="button"
>
  {#if variant.hasImage}
    <img
      src="local-file://{variant.filePath}?t={imageTimestamp}"
      alt={variant.displayName}
      class="slot-img"
    />
    <button class="slot-delete" onclick={onclear} title="Remove image">&times;</button>
  {:else}
    <button class="slot-add" onclick={handlePick} title="Add image">
      <span class="add-icon">+</span>
    </button>
  {/if}
  <span class="slot-label">{variant.displayName}</span>
</div>

<style>
  .variant-slot {
    position: relative;
    flex-shrink: 0;
    width: 110px;
    height: 200px;
    border: 2px dashed #d0d0d0;
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    background: #fafafa;
    outline: none;
    transition: border-color 0.15s;
  }

  .variant-slot.has-image {
    border-style: solid;
    border-color: #e0e0e0;
    cursor: grab;
  }

  .variant-slot.drag-over {
    border-color: #0066cc;
    border-style: solid;
    background: #f0f6ff;
  }

  .variant-slot:focus {
    border-color: #0066cc;
    box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.1);
  }

  .slot-img {
    width: 100%;
    flex: 1;
    object-fit: contain;
    display: block;
    min-height: 0;
  }

  .slot-delete {
    position: absolute;
    top: 3px;
    right: 3px;
    width: 22px;
    height: 22px;
    border: none;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    font-size: 0.875rem;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.15s;
  }

  .variant-slot:hover .slot-delete {
    opacity: 1;
  }

  .slot-add {
    flex: 1;
    width: 100%;
    border: none;
    background: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #888;
    font-family: inherit;
  }

  .slot-add:hover {
    color: #0066cc;
  }

  .add-icon {
    font-size: 2rem;
    font-weight: 300;
    line-height: 1;
  }

  .slot-label {
    font-size: 0.6875rem;
    color: #666;
    padding: 4px 4px;
    text-align: center;
    flex-shrink: 0;
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
