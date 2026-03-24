import { useRef, useEffect, useState } from 'react'
import { select } from 'd3-selection'
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom'
import { computeTreeLayout } from './TreeLayout'
import { PersonCardMini } from '../PersonCard/PersonCardMini'
import { Minimap } from './Minimap'
import type { Person, Relationship } from '../../types'

interface Props {
  persons: Person[]
  relationships: Relationship[]
  centerId: string
  highlightPersonId?: string | null
  onPersonClick: (personId: string) => void
}

export function TreeView({ persons, relationships, centerId, highlightPersonId, onPersonClick }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 })
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })

  const { nodes, groupFrames, backboneLinks } = computeTreeLayout(persons, relationships, centerId)

  useEffect(() => {
    if (!svgRef.current) return

    const svgEl = select(svgRef.current)
    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight
    setDimensions({ width, height })

    const zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .filter((event) => {
        if (event.type === 'wheel') return true
        if (event.type === 'dblclick') return true
        return event.type === 'mousedown' || event.type === 'touchstart'
      })
      .on('zoom', (event) => {
        setTransform({
          x: event.transform.x,
          y: event.transform.y,
          k: event.transform.k,
        })
      })

    svgEl.call(zoomBehavior)

    svgEl.call(
      zoomBehavior.transform,
      zoomIdentity.translate(width / 2, height * 0.75).scale(1),
    )

    return () => {
      svgEl.on('.zoom', null)
    }
  }, [])

  // Build partner links and bracket groups for parent-child connections
  const partnerLinks: Array<{ x1: number; y1: number; x2: number; y2: number }> = []
  const childToParents = new Map<string, typeof nodes>()

  for (const node of nodes) {
    for (const link of node.links) {
      const target = nodes.find(n => n.personId === link.targetId)
      if (!target) continue

      if (link.type === 'partner') {
        partnerLinks.push({ x1: node.x, y1: node.y, x2: target.x, y2: target.y })
      } else {
        const parents = childToParents.get(link.targetId) ?? []
        parents.push(node)
        childToParents.set(link.targetId, parents)
      }
    }
  }

  // Group children by parent set for bracket rendering
  const bracketMap = new Map<string, { parentIds: string[]; childIds: string[] }>()
  for (const [childId, parents] of childToParents) {
    const key = parents.map(p => p.personId).sort().join('|')
    const group = bracketMap.get(key) ?? { parentIds: parents.map(p => p.personId), childIds: [] }
    group.childIds.push(childId)
    bracketMap.set(key, group)
  }
  const brackets = Array.from(bracketMap.values())

  return (
    <div className="relative w-full h-full">
      <svg ref={svgRef} className="w-full h-full bg-bg-primary" style={{ touchAction: 'none' }}>
        <defs>
          <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.08" />
          </filter>
        </defs>
        <g ref={gRef} transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
          {/* Partner links (horizontal with 90-degree elbows) */}
          {partnerLinks.map((link, i) => {
            const midX = (link.x1 + link.x2) / 2
            return (
              <path
                key={`partner-${i}`}
                d={`M ${link.x1},${link.y1} H ${midX} V ${link.y2} H ${link.x2}`}
                stroke="#c4a77d"
                strokeWidth={2}
                strokeDasharray="6,4"
                fill="none"
              />
            )
          })}

          {/* Parent-child bracket lines (orthogonal 90-degree connectors) */}
          {brackets.map((group, i) => {
            const parentNodes = group.parentIds
              .map(id => nodes.find(n => n.personId === id))
              .filter((n): n is typeof nodes[0] => n !== undefined)
            const childNodes = group.childIds
              .map(id => nodes.find(n => n.personId === id))
              .filter((n): n is typeof nodes[0] => n !== undefined)
            if (parentNodes.length === 0 || childNodes.length === 0) return null

            const parentCenterX = parentNodes.reduce((sum, n) => sum + n.x, 0) / parentNodes.length
            const parentCenterY = parentNodes.reduce((sum, n) => sum + n.y, 0) / parentNodes.length
            const avgChildY = childNodes.reduce((sum, n) => sum + n.y, 0) / childNodes.length
            const junctionY = parentCenterY + 0.4 * (avgChildY - parentCenterY)

            if (childNodes.length === 1) {
              const child = childNodes[0]
              return (
                <path
                  key={`bracket-${i}`}
                  d={`M ${parentCenterX},${parentCenterY} V ${junctionY} H ${child.x} V ${child.y}`}
                  stroke="#aaa" strokeWidth={1.5} fill="none"
                />
              )
            }

            const childXs = childNodes.map(n => n.x)
            const minChildX = Math.min(...childXs)
            const maxChildX = Math.max(...childXs)

            return (
              <g key={`bracket-${i}`}>
                <line x1={parentCenterX} y1={parentCenterY} x2={parentCenterX} y2={junctionY} stroke="#aaa" strokeWidth={1.5} />
                <line x1={minChildX} y1={junctionY} x2={maxChildX} y2={junctionY} stroke="#aaa" strokeWidth={1.5} />
                {childNodes.map((child, j) => (
                  <line key={j} x1={child.x} y1={junctionY} x2={child.x} y2={child.y} stroke="#aaa" strokeWidth={1.5} />
                ))}
              </g>
            )
          })}

          {/* Backbone links (subtle lines connecting ancestor groups) */}
          {backboneLinks.map((link, i) => (
            <path
              key={`backbone-${i}`}
              d={link.points.map((p, j) => `${j === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ')}
              fill="none"
              stroke="#bbb"
              strokeWidth={1}
              strokeDasharray="4,4"
              opacity={0.3}
            />
          ))}

          {nodes.map((node) => (
            <PersonCardMini
              key={node.personId}
              person={node.person}
              x={node.x}
              y={node.y}
              highlight={node.personId === highlightPersonId}
              onClick={() => onPersonClick(node.personId)}
            />
          ))}
        </g>
      </svg>
      <Minimap
        nodes={nodes}
        viewportX={transform.x}
        viewportY={transform.y}
        viewportWidth={dimensions.width}
        viewportHeight={dimensions.height}
        scale={transform.k}
      />
    </div>
  )
}
