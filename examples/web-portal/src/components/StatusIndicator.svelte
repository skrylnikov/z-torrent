<script lang="ts">
  import { torrentState } from '../stores/torrent.js'
  import StatusPanel from './StatusPanel.svelte'
  import prettierBytes from 'prettier-bytes'

  let expanded = $state(false)
  let offline = $state(!navigator.onLine)

  $effect(() => {
    const onOnline = () => (offline = false)
    const onOffline = () => (offline = true)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  })

  function formatSpeed(bytes: number): string {
    return prettierBytes(bytes) + '/s'
  }
</script>

<button
  class="status-indicator"
  onclick={() => (expanded = !expanded)}
  aria-label="Torrent status"
>
  {#if offline}
    <span class="dot offline" title="Offline — serving from cache"></span>
  {:else}
    <span class="dot" class:seeding={$torrentState.phase === 'seeding'} class:error={$torrentState.phase === 'error'}></span>
  {/if}
  {#if $torrentState.downloadSpeed > 0}
    <span class="speed down">{formatSpeed($torrentState.downloadSpeed)}</span>
  {/if}
  {#if $torrentState.uploadSpeed > 0}
    <span class="speed up">{formatSpeed($torrentState.uploadSpeed)}</span>
  {/if}
  {#if $torrentState.peerCount > 0}
    <span class="peers">{$torrentState.peerCount}p</span>
  {/if}
</button>

{#if expanded}
  <StatusPanel onclose={() => (expanded = false)} />
{/if}

<style>
  .status-indicator {
    position: fixed;
    bottom: 12px;
    left: 12px;
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: var(--bg-glass);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    color: var(--text-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-pill);
    font-size: 11px;
    font-family: var(--font-mono);
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
    user-select: none;
  }

  .status-indicator:hover {
    border-color: var(--border-accent);
    background: rgba(15, 15, 25, 0.95);
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--amber);
    flex-shrink: 0;
    animation: pulse 2s ease-in-out infinite;
  }

  .dot.seeding {
    background: var(--accent);
    animation: none;
  }

  .dot.error {
    background: var(--red);
    animation: none;
  }

  .dot.offline {
    background: var(--text-muted);
    animation: none;
    opacity: 0.6;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  .speed {
    color: var(--text-secondary);
  }

  .down { color: var(--accent); }
  .up { color: var(--amber); }

  .peers {
    color: var(--text-muted);
  }
</style>
