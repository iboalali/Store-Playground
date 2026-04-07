<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    text: string
    children: Snippet
  }

  let { text, children }: Props = $props()
</script>

<span class="tooltip-wrapper">
  {@render children()}
  {#if text}
    <span class="tooltip-text">{text}</span>
  {/if}
</span>

<style>
  .tooltip-wrapper {
    position: relative;
    display: inline-flex;
  }

  .tooltip-text {
    visibility: hidden;
    opacity: 0;
    position: absolute;
    bottom: calc(100% + 6px);
    left: 50%;
    transform: translateX(-50%);
    background: #333;
    color: #fff;
    font-size: 0.6875rem;
    padding: 4px 8px;
    border-radius: 4px;
    white-space: pre-line;
    max-width: 260px;
    z-index: 100;
    pointer-events: none;
    transition: opacity 0.15s, visibility 0.15s;
    line-height: 1.4;
  }

  .tooltip-wrapper:hover .tooltip-text {
    visibility: visible;
    opacity: 1;
  }
</style>
