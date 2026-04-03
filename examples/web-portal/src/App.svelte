<script lang="ts">
  import { parseRoute } from './lib/url.js'
  import Landing from './components/Landing.svelte'
  import Viewer from './components/Viewer.svelte'
  import StatusIndicator from './components/StatusIndicator.svelte'

  let currentHash = $state<string | null>(null)
  let subpath = $state('')

  function handleNavigation() {
    const route = parseRoute(window.location.pathname)
    currentHash = route.hash
    subpath = route.subpath
  }

  function onNavigate(hash: string) {
    history.pushState(null, '', `/${hash}`)
    currentHash = hash
    subpath = ''
  }

  $effect(() => {
    handleNavigation()
    window.addEventListener('popstate', handleNavigation)
    return () => window.removeEventListener('popstate', handleNavigation)
  })
</script>

{#if currentHash}
  <Viewer hash={currentHash} {subpath} onNavigate={onNavigate} />
  <StatusIndicator />
{:else}
  <Landing {onNavigate} />
{/if}
