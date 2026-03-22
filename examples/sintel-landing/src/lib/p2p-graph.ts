/**
 * P2P network graph using D3 v7 force simulation.
 * Compatible API with p2p-graph for torrent peer visualization.
 */
import * as d3 from 'd3'
import prettierBytes from 'prettier-bytes'

export interface P2PGraphNode {
  id: string
  name: string
  me?: boolean
  downloaded?: number
  uploaded?: number
}

export type P2PPeerUpdate = Partial<Pick<P2PGraphNode, 'name' | 'downloaded' | 'uploaded'>>

export interface P2PGraphAPI {
  add: (peer: P2PGraphNode) => void
  connect: (sourceId: string, targetId: string) => void
  disconnect: (sourceId: string, targetId: string) => void
  remove: (id: string) => void
  updatePeer: (id: string, data: P2PPeerUpdate) => void
}

type LinkEnd = string | (P2PGraphNode & d3.SimulationNodeDatum)

type LinkDatum = { source: LinkEnd; target: LinkEnd }

const LINK_COLOR = '#C8C8C8'
const NODE_ME = 'hsl(210, 70%, 72.5%)'
const NODE_PEER = 'hsl(55, 70%, 72.5%)'
const NODE_HOVER = '#A9A9A9'

function linkId(v: LinkEnd): string {
  return typeof v === 'object' && v !== null && 'id' in v ? v.id : (v as string)
}

function linkKey(l: LinkDatum): string {
  return `${linkId(l.source)}-${linkId(l.target)}`
}

function peerTooltipText(d: P2PGraphNode & d3.SimulationNodeDatum): string {
  if (d.me) return ''
  const lines = [d.name]
  const down = d.downloaded ?? 0
  const up = d.uploaded ?? 0
  lines.push(`↓ ${prettierBytes(down)}  ↑ ${prettierBytes(up)}`)
  return lines.join('\n')
}

export function createP2PGraph(selector: string): P2PGraphAPI {
  const root =
    typeof selector === 'string' ? document.querySelector(selector) : selector
  if (!root || !(root instanceof HTMLElement)) {
    throw new Error(`P2PGraph: element not found: ${selector}`)
  }

  const nodes: (P2PGraphNode & d3.SimulationNodeDatum)[] = []
  const links: LinkDatum[] = []

  const width = () => root.offsetWidth
  const height = () => (window.innerWidth >= 900 ? 400 : 250)

  const svg = d3.select(root).append('svg').attr('class', 'p2p-graph-svg')

  const g = svg.append('g')
  const linkEl = g.append('g').attr('class', 'links')
  const nodeEl = g.append('g').attr('class', 'nodes')

  const getNode = (id: string) => nodes.find((n) => n.id === id)
  const hasLink = (s: string, t: string) =>
    links.some((l) => {
      const a = linkId(l.source)
      const b = linkId(l.target)
      return (a === s && b === t) || (a === t && b === s)
    })

  const simulation = d3
    .forceSimulation(nodes)
    .force(
      'link',
      d3.forceLink(links).id((d) => (d as P2PGraphNode).id).distance(100)
    )
    .force('charge', d3.forceManyBody().strength(-200))
    .force('center', d3.forceCenter(width() / 2, height() / 2))

  function resize() {
    const w = width()
    const h = height()
    svg.attr('width', w).attr('height', h)
    simulation.force('center', d3.forceCenter(w / 2, h / 2))
    simulation.alpha(0.3).restart()
  }

  function syncPeerDom(nodeSel: d3.Selection<SVGGElement, P2PGraphNode, SVGGElement, unknown>) {
    nodeSel.select('text').text((d) => d.name)
    nodeSel.each(function (d) {
      const circle = d3.select(this).select('circle')
      if (circle.select('title').empty()) circle.append('title')
      circle.select('title').text(peerTooltipText(d))
    })
  }

  function render() {
    const linkUpdate = linkEl
      .selectAll<SVGLineElement, LinkDatum>('line')
      .data(links, (d) => linkKey(d))

    linkUpdate.exit().remove()

    const link = linkUpdate
      .enter()
      .append('line')
      .attr('class', 'link')
      .attr('stroke', LINK_COLOR)
      .attr('stroke-opacity', 0.5)
      .attr('stroke-width', 0.7)
      .merge(linkUpdate)

    const nodeUpdate = nodeEl
      .selectAll<SVGGElement, P2PGraphNode>('g.node')
      .data(nodes, (d) => d.id)

    nodeUpdate.exit().remove()

    const nodeEnter = nodeUpdate
      .enter()
      .append('g')
      .attr('class', 'node')
      .call(
        d3
          .drag<SVGGElement, P2PGraphNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart()
            d.fx = d.x
            d.fy = d.y
          })
          .on('drag', (event, d) => {
            d.fx = event.x
            d.fy = event.y
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0)
            d.fx = null
            d.fy = null
          })
      )

    nodeEnter
      .append('circle')
      .attr('r', (d) => (d.me ? 15 : 10))
      .attr('fill', (d) => (d.me ? NODE_ME : NODE_PEER))
      .each(function (d) {
        d3.select(this).append('title').text(peerTooltipText(d))
      })
      .on('mouseover', function (event, d) {
        d3.select(this).attr('fill', NODE_HOVER)
      })
      .on('mouseout', function (event, d) {
        d3.select(this).attr('fill', d.me ? NODE_ME : NODE_PEER)
      })

    nodeEnter
      .append('text')
      .attr('dy', (d) => (d.me ? -22 : -15))
      .attr('text-anchor', 'middle')
      .attr('fill', '#C8C8C8')
      .attr('font-size', (d) => (d.me ? 16 : 12))
      .text((d) => d.name)

    const node = nodeEnter.merge(nodeUpdate)

    node
      .select('circle')
      .attr('r', (d) => (d.me ? 15 : 10))
      .attr('fill', (d) => (d.me ? NODE_ME : NODE_PEER))

    syncPeerDom(node)

    simulation.on('tick', () => {
      link
        .attr(
          'x1',
          (d) =>
            (typeof d.source === 'object' ? d.source.x : getNode(d.source as string)?.x) ?? 0
        )
        .attr(
          'y1',
          (d) =>
            (typeof d.source === 'object' ? d.source.y : getNode(d.source as string)?.y) ?? 0
        )
        .attr(
          'x2',
          (d) =>
            (typeof d.target === 'object' ? d.target.x : getNode(d.target as string)?.x) ?? 0
        )
        .attr(
          'y2',
          (d) =>
            (typeof d.target === 'object' ? d.target.y : getNode(d.target as string)?.y) ?? 0
        )

      node.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    simulation.nodes(nodes)
    simulation.force(
      'link',
      d3.forceLink(links).id((d) => (d as P2PGraphNode).id).distance(100)
    )
    simulation.alpha(0.5).restart()
  }

  window.addEventListener('resize', () => {
    resize()
  })
  resize()

  return {
    add(peer: P2PGraphNode) {
      if (getNode(peer.id)) return
      nodes.push(peer)
      render()
    },
    connect(sourceId: string, targetId: string) {
      if (!getNode(sourceId) || !getNode(targetId)) return
      if (hasLink(sourceId, targetId)) return
      links.push({ source: sourceId, target: targetId })
      render()
    },
    disconnect(sourceId: string, targetId: string) {
      const idx = links.findIndex((l) => {
        const a = linkId(l.source)
        const b = linkId(l.target)
        return (a === sourceId && b === targetId) || (a === targetId && b === sourceId)
      })
      if (idx === -1) return
      links.splice(idx, 1)
      render()
    },
    remove(id: string) {
      const idx = nodes.findIndex((n) => n.id === id)
      if (idx === -1) return
      nodes.splice(idx, 1)
      for (let i = links.length - 1; i >= 0; i--) {
        const l = links[i]
        if (linkId(l.source) === id || linkId(l.target) === id) links.splice(i, 1)
      }
      render()
    },
    updatePeer(id: string, data: P2PPeerUpdate) {
      const node = getNode(id)
      if (!node) return
      if (data.name !== undefined) node.name = data.name
      if (data.downloaded !== undefined) node.downloaded = data.downloaded
      if (data.uploaded !== undefined) node.uploaded = data.uploaded
      const sel = nodeEl.selectAll<SVGGElement, P2PGraphNode>('g.node').filter((d) => d.id === id)
      syncPeerDom(sel)
    },
  }
}
