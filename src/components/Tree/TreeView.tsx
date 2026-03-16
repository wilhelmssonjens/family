import { useRef, useEffect, useState, useCallback } from 'react'
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
  onPersonClick: (personId: string, screenPos: { x: number; y: number }) => void
  onAdd?: (personId: string, relationType: string) => void
  expandedPersonId: string | null
}

export function TreeView({ persons, relationships, centerId, onPersonClick, onAdd, expandedPersonId }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 })
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })

  const nodes = computeTreeLayout(persons, relationships, centerId)

  useEffect(() => {
    if (!svgRef.current) return

    const svgEl = select(svgRef.current)
    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight
    setDimensions({ width, height })

    const zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .filter((event) => {
        // Allow all scroll/wheel events for zoom
        // For mouse events, only allow if it's not a click on a card
        if (event.type === 'wheel') return true
        if (event.type === 'dblclick') return true
        // Allow drag (mousedown) but only when not on a card element
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

    // Center the view with a good zoom level
    svgEl.call(
      zoomBehavior.transform,
      zoomIdentity.translate(width / 2, height / 2).scale(1),
    )

    return () => {
      svgEl.on('.zoom', null)
    }
  }, [])

  // Build links for rendering
  const links: Array<{ x1: number; y1: number; x2: number; y2: number; type: string }> = []
  for (const node of nodes) {
    for (const link of node.links) {
      const target = nodes.find(n => n.personId === link.targetId)
      if (target) {
        links.push({
          x1: node.x, y1: node.y,
          x2: target.x, y2: target.y,
          type: link.type,
        })
      }
    }
  }

  // Create curved path for parent-child links
  const renderLink = useCallback((link: typeof links[0], i: number) => {
    if (link.type === 'partner') {
      // Dashed line for partners
      return (
        <line
          key={`link-${i}`}
          x1={link.x1} y1={link.y1}
          x2={link.x2} y2={link.y2}
          stroke="#c4a77d"
          strokeWidth={2}
          strokeDasharray="6,4"
        />
      )
    }

    // Curved path for parent-child
    const midX = (link.x1 + link.x2) / 2
    return (
      <path
        key={`link-${i}`}
        d={`M ${link.x1} ${link.y1} C ${midX} ${link.y1}, ${midX} ${link.y2}, ${link.x2} ${link.y2}`}
        fill="none"
        stroke="#aaa"
        strokeWidth={1.5}
      />
    )
  }, [])

  return (
    <div className="relative w-full h-full">
      <svg ref={svgRef} className="w-full h-full bg-bg-primary" style={{ touchAction: 'none' }}>
        <defs>
          <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.08" />
          </filter>
        </defs>
        <g ref={gRef} transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
          {/* Links rendered behind cards */}
          {links.map((link, i) => renderLink(link, i))}

          {/* Person cards */}
          {nodes.map((node) => (
            <PersonCardMini
              key={node.personId}
              person={node.person}
              x={node.x}
              y={node.y}
              isExpanded={expandedPersonId === node.personId}
              onClick={() => {
                // Calculate screen position from tree coordinates + current transform
                const screenX = node.x * transform.k + transform.x
                const screenY = node.y * transform.k + transform.y
                onPersonClick(node.personId, { x: screenX, y: screenY })
              }}
              onAdd={onAdd ? (relationType) => onAdd(node.personId, relationType) : undefined}
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
