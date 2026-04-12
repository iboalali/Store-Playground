<script lang="ts">
  import type { ScreenData } from '$shared/types/models'
  import VariantGrid from './VariantGrid.svelte'

  interface Props {
    screen: ScreenData
    imageTimestamp: number
    onsetimage: (variantSlug: string, sourcePath: string) => void
    onsetimagedata: (variantSlug: string, base64Data: string) => void
    onclearimage: (variantSlug: string) => void
    ondeletevariant: (variantSlug: string) => void
    onduplicatevariant: (variantSlug: string) => void
    onmoveimage: (
      fromScreenSlug: string,
      fromVariantSlug: string,
      toVariantSlug: string
    ) => void
    onexternaldrop: (variantSlug: string, filePath: string) => void
    onaddvariant: () => void
    onrename: () => void
    ondelete: () => void
    ondragstart: (e: DragEvent) => void
    ondragover: (e: DragEvent) => void
    ondragleave: () => void
    ondrop: () => void
  }

  let {
    screen,
    imageTimestamp,
    onsetimage,
    onsetimagedata,
    onclearimage,
    ondeletevariant,
    onduplicatevariant,
    onmoveimage,
    onexternaldrop,
    onaddvariant,
    onrename,
    ondelete,
    ondragstart,
    ondragover,
    ondragleave,
    ondrop
  }: Props = $props()
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="screen-row"
  ondragover={ondragover}
  ondragleave={ondragleave}
  ondrop={ondrop}
>
  <div class="screen-header">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <span
      class="drag-handle"
      draggable="true"
      ondragstart={ondragstart}
      title="Drag to reorder"
    >&#9776;</span>
    <h3 class="screen-name">{screen.displayName}</h3>
    <span class="screen-slug">/{screen.slug}</span>
    <div class="screen-actions">
      <button class="action-btn" onclick={onrename} title="Rename screen">Rename</button>
      <button class="action-btn danger" onclick={ondelete} title="Delete screen">Delete</button>
    </div>
  </div>

  <VariantGrid
    {screen}
    {imageTimestamp}
    {onsetimage}
    {onsetimagedata}
    {onclearimage}
    {ondeletevariant}
    {onduplicatevariant}
    {onmoveimage}
    {onexternaldrop}
    {onaddvariant}
  />
</div>

<style>
  .screen-row {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 12px 16px;
    background: #fff;
    transition: border-color 0.15s;
  }

  .screen-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .drag-handle {
    cursor: grab;
    font-size: 1rem;
    color: #aaa;
    user-select: none;
    padding: 2px 4px;
  }

  .drag-handle:hover {
    color: #666;
  }

  .screen-name {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0;
  }

  .screen-slug {
    font-size: 0.75rem;
    color: #aaa;
    font-family: monospace;
  }

  .screen-actions {
    margin-left: auto;
    display: flex;
    gap: 6px;
  }

  .action-btn {
    padding: 3px 10px;
    font-size: 0.75rem;
    border: 1px solid #d0d0d0;
    border-radius: 4px;
    background: #fff;
    color: #444;
    cursor: pointer;
    font-family: inherit;
  }

  .action-btn:hover {
    background: #f0f0f0;
  }

  .action-btn.danger:hover {
    background: #fef2f2;
    border-color: #d32f2f;
    color: #d32f2f;
  }
</style>
