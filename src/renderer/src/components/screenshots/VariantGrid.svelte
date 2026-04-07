<script lang="ts">
  import type { ScreenData } from '$shared/types/models'
  import VariantSlot from './VariantSlot.svelte'

  interface Props {
    screen: ScreenData
    imageTimestamp: number
    onsetimage: (variantSlug: string, sourcePath: string) => void
    onsetimagedata: (variantSlug: string, base64Data: string) => void
    onclearimage: (variantSlug: string) => void
    onmoveimage: (
      fromScreenSlug: string,
      fromVariantSlug: string,
      toVariantSlug: string
    ) => void
    onexternaldrop: (variantSlug: string, filePath: string) => void
    onaddvariant: () => void
  }

  let {
    screen,
    imageTimestamp,
    onsetimage,
    onsetimagedata,
    onclearimage,
    onmoveimage,
    onexternaldrop,
    onaddvariant
  }: Props = $props()
</script>

<div class="variant-grid">
  {#each screen.variants as variant (variant.slug)}
    <VariantSlot
      {variant}
      screenSlug={screen.slug}
      {imageTimestamp}
      onsetimage={(path) => onsetimage(variant.slug, path)}
      onsetimagedata={(data) => onsetimagedata(variant.slug, data)}
      onclear={() => onclearimage(variant.slug)}
      ondragstart={() => {}}
      ondrop={(srcScreen, srcVariant) => onmoveimage(srcScreen, srcVariant, variant.slug)}
      onexternaldrop={(path) => onexternaldrop(variant.slug, path)}
    />
  {/each}

  <button class="add-variant-btn" onclick={onaddvariant} title="Add variant">
    <span class="add-icon">+</span>
    <span class="add-text">Variant</span>
  </button>
</div>

<style>
  .variant-grid {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding: 8px 0 4px;
  }

  .add-variant-btn {
    flex-shrink: 0;
    width: 110px;
    height: 200px;
    border: 2px dashed #d0d0d0;
    border-radius: 8px;
    background: none;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    color: #888;
    font-family: inherit;
    transition: border-color 0.15s, color 0.15s;
  }

  .add-variant-btn:hover {
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
</style>
