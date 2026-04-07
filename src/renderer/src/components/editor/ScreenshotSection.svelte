<script lang="ts">
  import { ipc } from '$lib/ipc'
  import type { ScreenshotGroup } from '$shared/types/models'

  interface Props {
    group: ScreenshotGroup
    typeLabel: string
    maxCount: number
    imageTimestamp: number
    onadd: (sourcePath: string) => void
    onpaste: (base64Data: string) => void
    ondelete: (fileName: string) => void
    onreorder: (orderedFileNames: string[]) => void
  }

  let { group, typeLabel, maxCount, imageTimestamp, onadd, onpaste, ondelete, onreorder }: Props = $props()

  let dragSourceIdx = $state<number | null>(null)
  let dragOverIdx = $state<number | null>(null)

  async function handleAdd(): Promise<void> {
    const path = await ipc.openFileDialog({
      title: `Add ${typeLabel} Screenshot`,
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }]
    })
    if (path) {
      onadd(path)
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
        const base64 = btoa(binary)
        onpaste(base64)
        return
      }
    }
  }

  function handleDragStart(idx: number): void {
    dragSourceIdx = idx
  }

  function handleDragOver(e: DragEvent, idx: number): void {
    e.preventDefault()
    dragOverIdx = idx
  }

  function handleDragLeave(): void {
    dragOverIdx = null
  }

  function handleDrop(targetIdx: number): void {
    if (dragSourceIdx === null || dragSourceIdx === targetIdx) {
      dragSourceIdx = null
      dragOverIdx = null
      return
    }

    const names = group.screenshots.map((s) => s.fileName)
    const [moved] = names.splice(dragSourceIdx, 1)
    names.splice(targetIdx, 0, moved)

    dragSourceIdx = null
    dragOverIdx = null
    onreorder(names)
  }

  function handleDragEnd(): void {
    dragSourceIdx = null
    dragOverIdx = null
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="screenshot-section" tabindex="0" onpaste={handlePaste}>
  <div class="section-header">
    <h3 class="section-title">{typeLabel} Screenshots</h3>
    <span class="section-count">{group.screenshots.length}/{maxCount}</span>
  </div>

  <div class="screenshot-grid">
    {#each group.screenshots as screenshot, idx (screenshot.fileName)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="screenshot-thumb"
        class:drag-over={dragOverIdx === idx}
        class:dragging={dragSourceIdx === idx}
        draggable="true"
        ondragstart={() => handleDragStart(idx)}
        ondragover={(e) => handleDragOver(e, idx)}
        ondragleave={handleDragLeave}
        ondrop={() => handleDrop(idx)}
        ondragend={handleDragEnd}
      >
        <img
          src="file://{screenshot.filePath}?t={imageTimestamp}"
          alt="{typeLabel} {screenshot.fileName}"
          class="thumb-img"
        />
        <button
          class="thumb-delete"
          onclick={() => ondelete(screenshot.fileName)}
          title="Delete screenshot"
        >&times;</button>
        <span class="thumb-name">{screenshot.fileName}</span>
      </div>
    {/each}

    {#if group.screenshots.length < maxCount}
      <button class="add-btn" onclick={handleAdd}>
        <span class="add-icon">+</span>
        <span class="add-text">Add</span>
      </button>
    {/if}
  </div>

  {#if group.screenshots.length === 0}
    <p class="empty-hint">No screenshots yet. Click + to add or paste from clipboard.</p>
  {/if}
</div>

<style>
  .screenshot-section {
    outline: none;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 12px 16px;
    background: #fff;
  }

  .screenshot-section:focus {
    border-color: #0066cc;
    box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.1);
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .section-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0;
  }

  .section-count {
    font-size: 0.75rem;
    color: #888;
    font-variant-numeric: tabular-nums;
  }

  .screenshot-grid {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding-bottom: 4px;
  }

  .screenshot-thumb {
    position: relative;
    flex-shrink: 0;
    width: 100px;
    height: 180px;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    overflow: hidden;
    cursor: grab;
    background: #fafafa;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .screenshot-thumb.dragging {
    opacity: 0.4;
  }

  .screenshot-thumb.drag-over {
    border-color: #0066cc;
    border-width: 2px;
  }

  .thumb-img {
    width: 100%;
    flex: 1;
    object-fit: contain;
    display: block;
    min-height: 0;
  }

  .thumb-delete {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 20px;
    height: 20px;
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

  .screenshot-thumb:hover .thumb-delete {
    opacity: 1;
  }

  .thumb-name {
    font-size: 0.625rem;
    color: #888;
    padding: 2px 0;
    text-align: center;
    flex-shrink: 0;
  }

  .add-btn {
    flex-shrink: 0;
    width: 100px;
    height: 180px;
    border: 2px dashed #d0d0d0;
    border-radius: 6px;
    background: none;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    color: #888;
    font-family: inherit;
  }

  .add-btn:hover {
    border-color: #0066cc;
    color: #0066cc;
  }

  .add-icon {
    font-size: 1.5rem;
    font-weight: 300;
    line-height: 1;
  }

  .add-text {
    font-size: 0.75rem;
  }

  .empty-hint {
    font-size: 0.75rem;
    color: #aaa;
    text-align: center;
    padding: 8px 0 4px;
  }
</style>
