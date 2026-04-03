<script lang="ts">
  import { torrentState } from '../stores/torrent.js'
  import prettierBytes from 'prettier-bytes'

  let { onclose }: { onclose: () => void } = $props()

  const pct = $derived(Math.round($torrentState.progress * 100))

  function formatSpeed(bytes: number): string {
    if (bytes <= 0) return '0 B/s'
    return prettierBytes(bytes) + '/s'
  }
</script>

{#if $torrentState.phase !== 'connecting'}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="panel-backdrop" onclick={onclose} role="presentation"></div>
  <div class="panel">
    <div class="panel-header">
      <h3>Torrent Status</h3>
      <button class="btn-close" onclick={onclose} aria-label="Close panel">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>

    {#if $torrentState.siteName}
      <div class="section">
        <span class="label">Site</span>
        <span class="value">{$torrentState.siteName}</span>
      </div>
    {/if}

    <div class="section">
      <span class="label">Phase</span>
      <span class="value phase" class:seeding={$torrentState.phase === 'seeding'} class:error={$torrentState.phase === 'error'}>
        {$torrentState.phase}
      </span>
    </div>

    {#if $torrentState.totalSize > 0}
      <div class="section progress-section">
        <div class="progress-header">
          <span class="label">Progress</span>
          <span class="pct">{pct}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: {pct}%"></div>
        </div>
        <span class="size">{prettierBytes($torrentState.downloaded)} / {prettierBytes($torrentState.totalSize)}</span>
      </div>
    {/if}

    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-label">Download</span>
        <span class="stat-value">{formatSpeed($torrentState.downloadSpeed)}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Upload</span>
        <span class="stat-value">{formatSpeed($torrentState.uploadSpeed)}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Peers</span>
        <span class="stat-value">{$torrentState.peerCount}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">ETA</span>
        <span class="stat-value">
          {#if $torrentState.timeRemaining > 0}
            {Math.ceil($torrentState.timeRemaining / 1000)}s
          {:else}
            --
          {/if}
        </span>
      </div>
    </div>

    {#if $torrentState.manifest}
      <div class="section">
        <span class="label">Type</span>
        <span class="value">{$torrentState.manifest.type}</span>
      </div>
      {#if $torrentState.manifest.framework}
        <div class="section">
          <span class="label">Framework</span>
          <span class="value">{$torrentState.manifest.framework}</span>
        </div>
      {/if}
      {#if $torrentState.manifest._meta}
        <div class="section">
          <span class="label">Files</span>
          <span class="value">{$torrentState.manifest._meta.fileCount}</span>
        </div>
        <div class="section">
          <span class="label">Total Size</span>
          <span class="value">{prettierBytes($torrentState.manifest._meta.totalSize)}</span>
        </div>
      {/if}
    {/if}

    <div class="section">
      <span class="label">Info Hash</span>
      <span class="value hash">{$torrentState.infoHash ?? '--'}</span>
    </div>
  </div>
{/if}

<style>
  .panel-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9999;
  }

  .panel {
    position: fixed;
    bottom: 56px;
    left: 12px;
    z-index: 10000;
    width: 340px;
    max-height: 70vh;
    overflow-y: auto;
    background: var(--bg-glass);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-glass);
    padding: 16px;
    animation: slide-up 0.2s ease;
  }

  @keyframes slide-up {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .panel-header h3 {
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .btn-close {
    padding: 4px;
    color: var(--text-muted);
    border-radius: var(--radius-sm);
    transition: color 0.2s;
  }

  .btn-close:hover {
    color: var(--text-primary);
  }

  .section {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 0;
  }

  .section + .section {
    border-top: 1px solid var(--border);
  }

  .label {
    font-size: 0.75rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .value {
    font-size: 0.8rem;
    color: var(--text-secondary);
    font-family: var(--font-mono);
  }

  .value.hash {
    font-size: 0.65rem;
    word-break: break-all;
    max-width: 200px;
    text-align: right;
  }

  .phase {
    text-transform: capitalize;
  }

  .phase.seeding { color: var(--accent); }
  .phase.error { color: var(--red); }

  .progress-section {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
  }

  .progress-header {
    display: flex;
    justify-content: space-between;
  }

  .pct {
    font-size: 0.75rem;
    font-family: var(--font-mono);
    color: var(--text-secondary);
  }

  .progress-bar {
    width: 100%;
    height: 4px;
    background: var(--bg-tertiary);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .size {
    font-size: 0.7rem;
    font-family: var(--font-mono);
    color: var(--text-muted);
  }

  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin: 12px 0;
  }

  .stat-card {
    padding: 10px;
    background: var(--bg-tertiary);
    border-radius: var(--radius-sm);
  }

  .stat-label {
    display: block;
    font-size: 0.65rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 4px;
  }

  .stat-value {
    font-size: 0.85rem;
    font-family: var(--font-mono);
    color: var(--text-primary);
    font-weight: 500;
  }
</style>
