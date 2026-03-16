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
  onPersonClick: (personId: string) => void
  onAdd?: (personId: string, relationType: string) => void
  expandedPersonId: string | null
}

export function TreeView({ persons, relationships, centerId, onPersonClick, onAdd, expandedPersonId }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 })

  const nodes = computeTreeLayout(persons, relationships, centerId)

  useEffect(() => {
    if (!svgRef.current || !gRef.current) return

    const svgEl = select(svgRef.current)
    const zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 3])
      .on('zoom', (event) => {
        setTransform({
          x: event.transform.x,
          y: event.transform.y,
          k: event.transform.k,
        })
      })

    svgEl.call(zoomBehavior)

    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight
    svgEl.call(
      zoomBehavior.transform,
      zoomIdentity.translate(width / 2, height / 2).scale(0.8),
    )

    return () => {
      svgEl.on('.zoom', null)
    }
  }, [])

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

  const svgWidth = svgRef.current?.clientWidth ?? 800
  const svgHeight = svgRef.current?.clientHeight ?? 600

  return (
    <div className="relative w-full h-full">
      <svg ref={svgRef} className="w-full h-full bg-bg-primary" style={{ touchAction: 'none' }}>
        <defs>
          <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.08" />
          </filter>
        </defs>
        <g ref={gRef} transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
          {links.map((link, i) => (
            <line
              key={i}
              x1={link.x1} y1={link.y1}
              x2={link.x2} y2={link.y2}
              stroke={link.type === 'partner' ? '#c4a77d' : '#aaa'}
              strokeWidth={1.5}
              strokeDasharray={link.type === 'partner' ? '4,4' : undefined}
            />
          ))}

          {nodes.map((node) => (
            <PersonCardMini
              key={node.personId}
              person={node.person}
              x={node.x}
              y={node.y}
              isExpanded={expandedPersonId === node.personId}
              onClick={() => onPersonClick(node.personId)}
              onAdd={onAdd ? (relationType) => onAdd(node.personId, relationType) : undefined}
            />
          ))}
        </g>
      </svg>
      <Minimap
        nodes={nodes}
        viewportX={transform.x}
        viewportY={transform.y}
        viewportWidth={svgWidth}
        viewportHeight={svgHeight}
        scale={transform.k}
      />
    </div>
  )
}
