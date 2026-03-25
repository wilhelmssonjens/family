import { useRef, useEffect, useState } from 'react'
import { select } from 'd3-selection'
import { zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom'
import { computeTreeLayoutV3 } from './computeTreeLayoutV3'
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

  const result = computeTreeLayoutV3(persons, relationships, centerId)
  const { visualNodes, families, nodeIndex } = result

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

  return (
    <div className="relative w-full h-full">
      <svg ref={svgRef} className="w-full h-full bg-bg-primary" style={{ touchAction: 'none' }}>
        <defs>
          <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.08" />
          </filter>
        </defs>
        <g ref={gRef} transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
          {/* Family connectors: partner lines + parent-child brackets */}
          {families.map((fam, i) => {
            const parentPositions = fam.parentVisualIds
              .map(vid => nodeIndex.get(vid))
              .filter((n): n is NonNullable<typeof n> => n !== undefined)
            const childPositions = fam.childVisualIds
              .map(vid => nodeIndex.get(vid))
              .filter((n): n is NonNullable<typeof n> => n !== undefined)

            if (parentPositions.length === 0) return null

            // Partner line (dashed, between two parents)
            let partnerLine = null
            if (parentPositions.length >= 2) {
              const p0 = parentPositions[0]
              const p1 = parentPositions[1]
              const midX = (p0.x + p1.x) / 2
              partnerLine = (
                <path
                  d={`M ${p0.x},${p0.y} H ${midX} V ${p1.y} H ${p1.x}`}
                  stroke="#c4a77d"
                  strokeWidth={2}
                  strokeDasharray="6,4"
                  fill="none"
                />
              )
            }

            // No children — just render partner line
            if (childPositions.length === 0) {
              return <g key={`fam-${i}`}>{partnerLine}</g>
            }

            const parentCenterX = fam.centerX
            const junctionY = fam.parentY + 0.4 * (fam.childY - fam.parentY)

            // Single child: direct path from parent center to child
            if (childPositions.length === 1) {
              const child = childPositions[0]
              return (
                <g key={`fam-${i}`}>
                  {partnerLine}
                  <path
                    d={`M ${parentCenterX},${fam.parentY} V ${junctionY} H ${child.x} V ${child.y}`}
                    stroke="#aaa" strokeWidth={1.5} fill="none"
                  />
                </g>
              )
            }

            // Multiple children: bracket
            const childXs = childPositions.map(n => n.x)
            const minChildX = Math.min(...childXs)
            const maxChildX = Math.max(...childXs)

            return (
              <g key={`fam-${i}`}>
                {partnerLine}
                <line x1={parentCenterX} y1={fam.parentY} x2={parentCenterX} y2={junctionY} stroke="#aaa" strokeWidth={1.5} />
                <line x1={minChildX} y1={junctionY} x2={maxChildX} y2={junctionY} stroke="#aaa" strokeWidth={1.5} />
                {childPositions.map((child, j) => (
                  <line key={j} x1={child.x} y1={junctionY} x2={child.x} y2={child.y} stroke="#aaa" strokeWidth={1.5} />
                ))}
              </g>
            )
          })}

          {visualNodes.map((node) => (
            <PersonCardMini
              key={node.visualId}
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
        nodes={visualNodes}
        viewportX={transform.x}
        viewportY={transform.y}
        viewportWidth={dimensions.width}
        viewportHeight={dimensions.height}
        scale={transform.k}
      />
    </div>
  )
}
