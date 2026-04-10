<script lang="ts">
  import type { AppEntry } from '$shared/types/models'
  import { goToDashboard } from '../../router.svelte'
  import defaultIcon from '../../assets/default-app-icon.png'

  interface Props {
    appEntry: AppEntry
  }
  let { appEntry }: Props = $props()

  let iconSrc = $derived(
    appEntry.hasIcon ? `local-file://${appEntry.appPath}/icon.png` : defaultIcon
  )

  function handleImgError(e: Event): void {
    (e.target as HTMLImageElement).src = defaultIcon
  }
</script>

<button class="app-card" onclick={() => goToDashboard(appEntry.appPath)}>
  <img src={iconSrc} alt="" class="app-icon" onerror={handleImgError} />
  <span class="app-name">{appEntry.config.appName}</span>
  <span class="package-name">{appEntry.config.packageName}</span>
</button>

<style>
  .app-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 20px 16px;
    background: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 12px;
    cursor: pointer;
    font-family: inherit;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .app-card:hover {
    border-color: #bdbdbd;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  .app-icon {
    width: 64px;
    height: 64px;
    border-radius: 14px;
    object-fit: cover;
  }

  .app-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1a1a1a;
    text-align: center;
    word-break: break-word;
  }

  .package-name {
    font-size: 0.75rem;
    color: #888;
    text-align: center;
    word-break: break-all;
  }
</style>
