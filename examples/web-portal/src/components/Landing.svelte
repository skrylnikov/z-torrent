<script lang="ts">
  import { extractHash } from '../lib/url.js'

  let { onNavigate }: { onNavigate: (hash: string) => void } = $props()

  let address = $state('')
  let focused = $state(false)

  function handleSubmit(e: Event) {
    e.preventDefault()
    const hash = extractHash(address)
    if (hash) onNavigate(hash)
  }
</script>

<main class="landing">
  <div class="landing-inner">
    <div class="brand">
      <div class="logo">
        <svg viewBox="0 0 32 32" width="48" height="48" fill="none">
          <circle cx="16" cy="16" r="14" stroke="#22c55e" stroke-width="2" fill="#0a0a0f"/>
          <path d="M10 20 L16 8 L22 20 Z" fill="#22c55e"/>
          <path d="M12 20 L16 12 L20 20 Z" fill="#0a0a0f"/>
          <path d="M10 20 L22 20" stroke="#22c55e" stroke-width="1.5"/>
          <path d="M16 12 L16 8" stroke="#22c55e" stroke-width="1.5"/>
        </svg>
      </div>
      <h1>Z-Torrent</h1>
      <p class="tagline">Decentralized web hosting powered by BitTorrent</p>
    </div>

    <form class="search" onsubmit={handleSubmit}>
      <div class="input-wrap" class:focused>
        <svg class="icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="M21 21l-4.35-4.35"/>
        </svg>
        <input
          type="text"
          bind:value={address}
          placeholder="Enter info hash, magnet URI, or URL..."
          onfocus={() => focused = true}
          onblur={() => focused = false}
        />
        <button type="submit" class="btn-load" disabled={!address.trim()}>Load</button>
      </div>
    </form>

    <footer class="footer">
      <p>Websites are loaded directly from the BitTorrent network. No servers, no gatekeepers.</p>
    </footer>
  </div>
</main>

<style>
  .landing {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background:
      radial-gradient(ellipse at 50% 0%, rgba(34, 197, 94, 0.06) 0%, transparent 60%),
      var(--bg-primary);
  }

  .landing-inner {
    max-width: 560px;
    width: 100%;
    text-align: center;
  }

  .brand {
    margin-bottom: 40px;
  }

  .logo {
    margin-bottom: 16px;
  }

  h1 {
    font-size: 2rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text-primary);
  }

  .tagline {
    margin-top: 8px;
    color: var(--text-secondary);
    font-size: 1.05rem;
  }

  .search {
    margin-bottom: 48px;
  }

  .input-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 6px 6px 16px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    transition: border-color 0.2s, box-shadow 0.2s;
  }

  .input-wrap.focused {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
  }

  .icon {
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .input-wrap input {
    flex: 1;
    border: none;
    background: none;
    padding: 8px 0;
    font-size: 0.95rem;
  }

  .input-wrap input:focus {
    box-shadow: none;
  }

  .btn-load {
    padding: 8px 20px;
    background: var(--accent);
    color: #000;
    font-weight: 600;
    font-size: 0.875rem;
    border-radius: var(--radius-md);
    transition: background 0.2s;
  }

  .btn-load:hover:not(:disabled) {
    background: var(--accent-dim);
  }

  .btn-load:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .footer p {
    font-size: 0.8rem;
    color: var(--text-muted);
  }
</style>
