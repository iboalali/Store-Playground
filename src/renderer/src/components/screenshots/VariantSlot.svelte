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
    ondelete: () => void
    onduplicate: () => void
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
    ondelete,
    onduplicate,
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
  {:else}
    <div class="slot-empty">
      <span class="empty-icon">+</span>
    </div>
  {/if}

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="slot-overlay" onclick={(e) => e.stopPropagation()} onmousedown={(e) => e.stopPropagation()}>
    <button class="overlay-btn" onclick={handlePick} title={variant.hasImage ? 'Replace image' : 'Add image'}>
      <svg width="16" height="16" viewBox="0 -960 960 960" fill="currentColor">
        {#if variant.hasImage}
          <path d="M360-360h60v-120h120v-60H420v-120h-60v120H240v60h120v120ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-560v-200H240v640h480v-440H520ZM240-800v200-200 640-640Z"/>
        {:else}
          <path d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z"/>
        {/if}
      </svg>
    </button>
    <button class="overlay-btn" onclick={onduplicate} title="Duplicate variant">
      <svg width="16" height="16" viewBox="0 -960 960 960" fill="currentColor">
        <path d="M360-240q-33 0-56.5-23.5T280-320v-480q0-33 23.5-56.5T360-880h360q33 0 56.5 23.5T800-800v480q0 33-23.5 56.5T720-240H360Zm0-80h360v-480H360v480ZM200-80q-33 0-56.5-23.5T120-160v-560h80v560h440v80H200Zm160-240v-480 480Z"/>
      </svg>
    </button>
    {#if variant.hasImage}
      <button class="overlay-btn" onclick={onclear} title="Remove image">
        <svg width="16" height="16" viewBox="0 -960 960 960" fill="currentColor">
          <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/>
        </svg>
      </button>
    {/if}
    <button class="overlay-btn danger" onclick={ondelete} title="Delete variant">
      <svg width="16" height="16" viewBox="0 -960 960 960" fill="currentColor">
        <path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/>
      </svg>
    </button>
  </div>

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

  .slot-empty {
    flex: 1;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ccc;
  }

  .empty-icon {
    font-size: 2rem;
    font-weight: 300;
    line-height: 1;
  }

  .slot-overlay {
    position: absolute;
    inset: 0;
    bottom: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    background: rgba(0, 0, 0, 0.45);
    opacity: 0;
    transition: opacity 0.15s;
  }

  .variant-slot:hover .slot-overlay,
  .variant-slot:focus .slot-overlay {
    opacity: 1;
  }

  .overlay-btn {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.9);
    color: #333;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    transition: background 0.1s, color 0.1s;
  }

  .overlay-btn:hover {
    background: #fff;
    color: #0066cc;
  }

  .overlay-btn.danger:hover {
    background: #fff;
    color: #d32f2f;
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
