<script lang="ts">
  import { ipc } from '$lib/ipc'
  import { IMAGE_FILES } from '../../stores/editor.svelte'
  import ImageSlot from './ImageSlot.svelte'

  interface Props {
    images: Record<string, { filePath: string; exists: boolean }>
    localePath: string
    imageTimestamp: number
    imageErrors?: Record<string, string>
    onaddimage: (key: string, sourcePath: string) => void
    ondeleteimage: (key: string) => void
    onpasteimage: (key: string, base64Data: string) => void
  }

  let { images, localePath, imageTimestamp, imageErrors = {}, onaddimage, ondeleteimage, onpasteimage }: Props = $props()

  async function handlePick(key: string): Promise<void> {
    const path = await ipc.openFileDialog({
      title: 'Select Image',
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }]
    })
    if (path) {
      onaddimage(key, path)
    }
  }
</script>

<div class="image-grid">
  {#each IMAGE_FILES as img (img.key)}
    {@const info = images[img.key]}
    <div class="image-cell">
      <ImageSlot
        label={img.label}
        dimensions={img.dimensions}
        filePath={info?.exists ? info.filePath : null}
        {imageTimestamp}
        validationError={imageErrors[img.fileName] ?? null}
        onpick={() => handlePick(img.key)}
        ondelete={() => ondeleteimage(img.key)}
        onpaste={(base64) => onpasteimage(img.key, base64)}
      />
    </div>
  {/each}
</div>

<style>
  .image-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }

  .image-cell {
    min-width: 0;
  }
</style>
