<script lang="ts">
  import type { TorrentState } from '../lib/torrent-loader.js'
  import prettierBytes from 'prettier-bytes'

  let { state: torrentState }: { state: TorrentState } = $props()

  let startTime = $state(Date.now())
  let hint = $state<string | null>(null)

  const phaseLabel: Record<TorrentState['phase'], string> = {
    connecting: 'Connecting to peers...',
    metadata: 'Fetching torrent metadata...',
    downloading: 'Loading site...',
    ready: 'Ready',
    seeding: 'Seeding',
    error: 'Could not load site',
  }

  const pct = $derived(Math.round(torrentState.progress * 100))
  const isActive = $derived(torrentState.phase === 'downloading' || torrentState.phase === 'seeding')
  const elapsed = $derived(Date.now() - startTime)

  $effect(() => {
    if (torrentState.phase === 'connecting' || torrentState.phase === 'metadata') {
      startTime = Date.now()
    }
  })

  $effect(() => {
    if (torrentState.phase === 'error' || torrentState.phase === 'seeding') {
      hint = null
      return
    }
    if (elapsed > 15000 && torrentState.peerCount === 0) {
      hint = 'Check your internet connection'
    } else if (elapsed > 30000 && torrentState.peerCount === 0) {
      hint = 'No peers found yet. If the site was recently published, it may take a moment for the seed server to respond.'
    } else if (elapsed > 30000 && torrentState.peerCount > 0 && pct < 10) {
      hint = 'Connected to peers but download is slow. The site may be large.'
    } else {
      hint = null
    }
  })
</script>

<div class="loading-screen" class:error={torrentState.phase === 'error'}>
  <div class="content">
    {#if torrentState.phase === 'error'}
      <div class="error-icon">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="var(--red)" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M15 9l-6 6M9 9l6 6"/>
        </svg>
      </div>
      <h2>{phaseLabel[torrentState.phase]}</h2>
      {#if torrentState.error}
        <p class="error-msg">{torrentState.error}</p>
      {/if}
    {:else}
      {#if torrentState.siteName}
        <h2 class="site-name">{torrentState.siteName}</h2>
      {/if}

      {#if !isActive}
        <div class="spinner-wrap">
          <div class="spinner"></div>
        </div>

        <p class="phase-label">{phaseLabel[torrentState.phase]}</p>

        {#if hint}
          <div class="hint">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            <span>{hint}</span>
          </div>
        {/if}
      {:else}
        <div class="progress-section">
          <div class="progress-bar">
            <div class="progress-fill" style="width: {pct}%"></div>
          </div>
          <p class="pct">{pct}%</p>
        </div>
      {/if}

      <div class="stats">
        {#if torrentState.downloadSpeed > 0}
          <span class="stat">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {prettierBytes(torrentState.downloadSpeed)}/s
          </span>
        {/if}
        {#if torrentState.peerCount > 0}
          <span class="stat">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            {torrentState.peerCount} peer{torrentState.peerCount !== 1 ? 's' : ''}
          </span>
        {/if}
        {#if torrentState.timeRemaining > 0}
          <span class="stat">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            {formatTime(torrentState.timeRemaining)}
          </span>
        {/if}
      </div>

      {#if torrentState.downloaded > 0 && torrentState.totalSize > 0}
        <p class="size">{prettierBytes(torrentState.downloaded)} / {prettierBytes(torrentState.totalSize)}</p>
      {/if}

      {#if hint && isActive}
        <div class="hint">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="16" x2="12" y2="12"/>
            <line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          <span>{hint}</span>
        </div>
      {/if}
    {/if}
  </div>
</div>

{#snippet formatTime(ms: number)}
  {#if ms > 3600000}
    {Math.ceil(ms / 3600000)}h {Math.ceil((ms % 3600000) / 60000)}m
  {:else if ms > 60000}
    {Math.ceil(ms / 60000)}m
  {:else}
    {Math.ceil(ms / 1000)}s
  {/if}
{/snippet}

<style>
  .loading-screen {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-primary);
    z-index: 10;
    transition: opacity 0.4s ease;
  }

  .content {
    text-align: center;
    max-width: 360px;
    animation: fade-in 0.3s ease;
  }

  @keyframes fade-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .site-name {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 32px;
  }

  .spinner-wrap {
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .phase-label {
    color: var(--text-secondary);
    font-size: 0.95rem;
    margin-bottom: 20px;
    transition: color 0.3s ease;
  }

  .progress-section {
    margin-bottom: 20px;
  }

  .progress-bar {
    width: 100%;
    height: 6px;
    background: var(--bg-tertiary);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 8px;
  }

  .progress-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  .pct {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    color: var(--text-secondary);
  }

  .stats {
    display: flex;
    justify-content: center;
    gap: 16px;
    margin-bottom: 12px;
  }

  .stat {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.8rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
  }

  .stat svg {
    opacity: 0.6;
  }

  .size {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .hint {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-top: 16px;
    padding: 10px 14px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    text-align: left;
    animation: fade-in 0.3s ease;
  }

  .hint svg {
    flex-shrink: 0;
    color: var(--amber);
    margin-top: 2px;
  }

  .hint span {
    font-size: 0.8rem;
    color: var(--text-secondary);
    line-height: 1.4;
  }

  .error .content h2 {
    color: var(--red);
    font-size: 1.1rem;
  }

  .error-icon {
    margin-bottom: 16px;
  }

  .error-msg {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin-top: 8px;
    word-break: break-word;
  }
</style>
