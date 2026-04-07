<script lang="ts">
  import type { ScreenData } from '$shared/types/models'
  import ScreenRow from './ScreenRow.svelte'

  interface Props {
    screens: ScreenData[]
    imageTimestamp: number
    onsetimage: (screenSlug: string, variantSlug: string, sourcePath: string) => void
    onsetimagedata: (screenSlug: string, variantSlug: string, base64Data: string) => void
    onclearimage: (screenSlug: string, variantSlug: string) => void
    onmoveimage: (
      fromScreenSlug: string,
      fromVariantSlug: string,
      toScreenSlug: string,
      toVariantSlug: string
    ) => void
    onexternaldrop: (screenSlug: string, variantSlug: string, filePath: string) => void
    onaddvariant: (screenSlug: string) => void
    onrenamescreen: (screenSlug: string) => void
    ondeletescreen: (screenSlug: string) => void
    onreorderscreens: (newOrder: string[]) => void
  }

  let {
    screens,
    imageTimestamp,
    onsetimage,
    onsetimagedata,
    onclearimage,
    onmoveimage,
    onexternaldrop,
    onaddvariant,
    onrenamescreen,
    ondeletescreen,
    onreorderscreens
  }: Props = $props()

  let dragSourceIdx = $state<number | null>(null)
  let dragOverIdx = $state<number | null>(null)

  function handleDragStart(e: DragEvent, idx: number): void {
    if (!e.dataTransfer) return
    e.dataTransfer.setData('text/x-screen-reorder', String(idx))
    e.dataTransfer.effectAllowed = 'move'
    dragSourceIdx = idx
  }

  function handleDragOver(e: DragEvent, idx: number): void {
    // Only handle screen reorder drags, not variant drags
    if (dragSourceIdx === null) return
    e.preventDefault()
    dragOverIdx = idx
  }

  function handleDragLeave(idx: number): void {
    if (dragOverIdx === idx) {
      dragOverIdx = null
    }
  }

  function handleDrop(targetIdx: number): void {
    if (dragSourceIdx === null || dragSourceIdx === targetIdx) {
      dragSourceIdx = null
      dragOverIdx = null
      return
    }

    const slugs = screens.map((s) => s.slug)
    const [moved] = slugs.splice(dragSourceIdx, 1)
    slugs.splice(targetIdx, 0, moved)

    dragSourceIdx = null
    dragOverIdx = null
    onreorderscreens(slugs)
  }
</script>

<div class="screen-list">
  {#each screens as screen, idx (screen.slug)}
    <div
      class="screen-list-item"
      class:drag-over={dragOverIdx === idx}
      class:dragging={dragSourceIdx === idx}
    >
      <ScreenRow
        {screen}
        {imageTimestamp}
        onsetimage={(vSlug, path) => onsetimage(screen.slug, vSlug, path)}
        onsetimagedata={(vSlug, data) => onsetimagedata(screen.slug, vSlug, data)}
        onclearimage={(vSlug) => onclearimage(screen.slug, vSlug)}
        onmoveimage={(fromScreen, fromVariant, toVariant) =>
          onmoveimage(fromScreen, fromVariant, screen.slug, toVariant)}
        onexternaldrop={(vSlug, path) => onexternaldrop(screen.slug, vSlug, path)}
        onaddvariant={() => onaddvariant(screen.slug)}
        onrename={() => onrenamescreen(screen.slug)}
        ondelete={() => ondeletescreen(screen.slug)}
        ondragstart={(e) => handleDragStart(e, idx)}
        ondragover={(e) => handleDragOver(e, idx)}
        ondragleave={() => handleDragLeave(idx)}
        ondrop={() => handleDrop(idx)}
      />
    </div>
  {/each}

  {#if screens.length === 0}
    <p class="empty-hint">No screens yet. Click "Add Screen" to create one.</p>
  {/if}
</div>

<style>
  .screen-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .screen-list-item {
    transition: opacity 0.15s;
  }

  .screen-list-item.dragging {
    opacity: 0.4;
  }

  .screen-list-item.drag-over {
    border-top: 3px solid #0066cc;
    padding-top: 3px;
  }

  .empty-hint {
    text-align: center;
    color: #aaa;
    font-size: 0.875rem;
    padding: 40px 0;
  }
</style>
