<script lang="ts">
  import { ipc } from '$lib/ipc'
  import type { ScreenshotConfig, ScreenMeta } from '$shared/types/models'

  interface Props {
    open: boolean
    appPath: string
    imageTimestamp: number
    onpick: (filePath: string) => void
    oncancel: () => void
  }

  let { open, appPath, imageTimestamp, onpick, oncancel }: Props = $props()

  let dialogEl = $state<HTMLDialogElement | undefined>(undefined)
  let config = $state<ScreenshotConfig | null>(null)
  let activeVersion = $state<string | null>(null)
  let screenData = $state<
    Array<{
      slug: string
      displayName: string
      variants: Array<{ slug: string; displayName: string; filePath: string; hasImage: boolean }>
    }>
  >([])
  let loading = $state(false)

  function joinPath(base: string, ...rest: string[]): string {
    const sep = base.includes('\\') ? '\\' : '/'
    return [base, ...rest].join(sep)
  }

  $effect(() => {
    if (open && dialogEl && !dialogEl.open) {
      dialogEl.showModal()
      loadConfig()
    } else if (!open && dialogEl?.open) {
      dialogEl.close()
    }
  })

  function handleClose(): void {
    if (open) oncancel()
  }

  async function loadConfig(): Promise<void> {
    loading = true
    const screenshotsRoot = joinPath(appPath, 'screenshots')
    try {
      config = (await ipc.readJsonFile(
        joinPath(screenshotsRoot, 'screenshot_config.json')
      )) as ScreenshotConfig

      if (config.versionOrder.length > 0) {
        await loadVersion(config.versionOrder[0])
      } else {
        activeVersion = null
        screenData = []
      }
    } catch {
      config = null
      screenData = []
    } finally {
      loading = false
    }
  }

  async function loadVersion(versionName: string): Promise<void> {
    if (!config) return
    activeVersion = versionName

    const screenshotsRoot = joinPath(appPath, 'screenshots')
    const versionDir = joinPath(screenshotsRoot, 'versions', versionName)
    const versionMeta = config.versions[versionName]
    if (!versionMeta) {
      screenData = []
      return
    }

    const screens: typeof screenData = []
    for (const screenSlug of versionMeta.screenOrder) {
      const screenDir = joinPath(versionDir, screenSlug)
      try {
        const meta = (await ipc.readJsonFile(
          joinPath(screenDir, '_screen.json')
        )) as ScreenMeta

        let dirFiles: string[] = []
        try {
          const entries = await ipc.listDirectory(screenDir)
          dirFiles = entries.filter((e) => !e.isDirectory).map((e) => e.name)
        } catch {
          dirFiles = []
        }

        const variants = meta.variantOrder.map((slug) => {
          const imageFile = dirFiles.find(
            (f) => f.startsWith(slug + '.') && /\.(png|jpg|jpeg)$/i.test(f)
          )
          const ext = imageFile ? imageFile.split('.').pop()! : 'png'
          return {
            slug,
            displayName: meta.variantNames[slug] || slug,
            filePath: joinPath(screenDir, `${slug}.${ext}`),
            hasImage: !!imageFile
          }
        })

        screens.push({ slug: screenSlug, displayName: meta.displayName, variants })
      } catch {
        // Skip broken screens
      }
    }
    screenData = screens
  }

  function handlePick(filePath: string): void {
    onpick(filePath)
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<dialog bind:this={dialogEl} onclose={handleClose} class="picker-dialog">
  <div class="picker-header">
    <h2>Pick from Screenshot Library</h2>
    <button class="close-btn" onclick={oncancel}>&times;</button>
  </div>

  {#if loading}
    <p class="picker-status">Loading...</p>
  {:else if !config || config.versionOrder.length === 0}
    <p class="picker-status">No screenshot versions found. Create screenshots in the Screenshot Manager first.</p>
  {:else}
    <div class="version-tabs">
      {#each config.versionOrder as version (version)}
        <button
          class="version-tab"
          class:active={version === activeVersion}
          onclick={() => loadVersion(version)}
        >
          {version.replace(/_/g, ' ')}
        </button>
      {/each}
    </div>

    <div class="picker-content">
      {#each screenData as screen (screen.slug)}
        <div class="screen-section">
          <h3 class="screen-name">{screen.displayName}</h3>
          <div class="variant-thumbs">
            {#each screen.variants as variant (variant.slug)}
              {#if variant.hasImage}
                <button
                  class="thumb-btn"
                  onclick={() => handlePick(variant.filePath)}
                  title="Pick {variant.displayName}"
                >
                  <img
                    src="local-file://{variant.filePath}?t={imageTimestamp}"
                    alt={variant.displayName}
                    class="thumb-img"
                  />
                  <span class="thumb-label">{variant.displayName}</span>
                </button>
              {/if}
            {/each}
            {#if screen.variants.filter((v) => v.hasImage).length === 0}
              <span class="no-images">No images</span>
            {/if}
          </div>
        </div>
      {/each}

      {#if screenData.length === 0}
        <p class="picker-status">No screens in this version.</p>
      {/if}
    </div>
  {/if}
</dialog>

<style>
  .picker-dialog {
    width: 700px;
    max-width: 90vw;
    max-height: 80vh;
    border: none;
    border-radius: 12px;
    padding: 0;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .picker-dialog::backdrop {
    background: rgba(0, 0, 0, 0.3);
  }

  .picker-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid #e0e0e0;
    flex-shrink: 0;
  }

  .picker-header h2 {
    margin: 0;
    font-size: 1rem;
    color: #1a1a1a;
  }

  .close-btn {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 6px;
    background: none;
    color: #666;
    font-size: 1.25rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    background: #f0f0f0;
    color: #1a1a1a;
  }

  .picker-status {
    padding: 40px 20px;
    text-align: center;
    color: #888;
    font-size: 0.875rem;
  }

  .version-tabs {
    display: flex;
    overflow-x: auto;
    border-bottom: 1px solid #e0e0e0;
    flex-shrink: 0;
  }

  .version-tab {
    padding: 8px 16px;
    border: none;
    border-bottom: 2px solid transparent;
    background: none;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.8125rem;
    color: #555;
    white-space: nowrap;
  }

  .version-tab:hover {
    background: #f8f8f8;
  }

  .version-tab.active {
    color: #0066cc;
    border-bottom-color: #0066cc;
    font-weight: 600;
  }

  .picker-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
  }

  .screen-section {
    margin-bottom: 20px;
  }

  .screen-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0 0 8px;
  }

  .variant-thumbs {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 4px;
  }

  .thumb-btn {
    flex-shrink: 0;
    width: 90px;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    background: #fafafa;
    cursor: pointer;
    padding: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .thumb-btn:hover {
    border-color: #0066cc;
    box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.15);
  }

  .thumb-img {
    width: 100%;
    height: 140px;
    object-fit: contain;
    display: block;
  }

  .thumb-label {
    font-size: 0.625rem;
    color: #666;
    padding: 3px 4px;
    text-align: center;
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .no-images {
    font-size: 0.75rem;
    color: #aaa;
    padding: 8px;
  }
</style>
