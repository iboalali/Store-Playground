<script lang="ts">
  import VersionActions from './VersionActions.svelte'
  import type { VersionEntry } from '$shared/types/models'

  interface Props {
    version: VersionEntry
  }
  let { version }: Props = $props()

  const createdDate = $derived(
    new Date(version.metadata.createdAt).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  )

  const statusColor = $derived(
    version.metadata.status === 'published'
      ? '#2e7d32'
      : version.metadata.status === 'archived'
        ? '#888'
        : '#ed6c02'
  )
</script>

<div class="version-card" class:live={version.isLive}>
  <div class="card-header">
    <h3 class="version-name">{version.dirName}</h3>
    <div class="badges">
      {#if version.isLive}
        <span class="badge badge-live">LIVE</span>
      {/if}
      <span class="badge badge-status" style:background={statusColor}>
        {version.metadata.status}
      </span>
    </div>
  </div>

  <div class="card-meta">
    <span class="meta-item">Created: {createdDate}</span>
    {#if version.metadata.customNotes}
      <p class="notes">{version.metadata.customNotes}</p>
    {/if}
  </div>

  <div class="card-actions">
    <VersionActions {version} />
  </div>
</div>

<style>
  .version-card {
    background: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .version-card.live {
    border-color: #0066cc;
    border-width: 2px;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .version-name {
    font-size: 0.9375rem;
    font-weight: 600;
    color: #1a1a1a;
    margin: 0;
    word-break: break-all;
  }

  .badges {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }

  .badge {
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #fff;
  }

  .badge-live {
    background: #0066cc;
  }

  .card-meta {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .meta-item {
    font-size: 0.8125rem;
    color: #666;
  }

  .notes {
    font-size: 0.8125rem;
    color: #888;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .card-actions {
    border-top: 1px solid #f0f0f0;
    padding-top: 12px;
  }
</style>
