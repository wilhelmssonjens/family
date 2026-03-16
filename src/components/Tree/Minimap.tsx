import type { LayoutNode } from './TreeLayout'

interface Props {
  nodes: LayoutNode[]
  viewportX: number
  viewportY: number
  viewportWidth: number
  viewportHeight: number
  scale: number
}

const MINIMAP_WIDTH = 160
const MINIMAP_HEIGHT = 100

export function Minimap({ nodes, viewportX, viewportY, viewportWidth, viewportHeight, scale }: Props) {
  if (nodes.length === 0) return null

  const xs = nodes.map(n => n.x)
  const ys = nodes.map(n => n.y)
  const minX = Math.min(...xs) - 100
  const maxX = Math.max(...xs) + 100
  const minY = Math.min(...ys) - 100
  const maxY = Math.max(...ys) + 100

  const treeWidth = maxX - minX
  const treeHeight = maxY - minY

  const scaleX = MINIMAP_WIDTH / treeWidth
  const scaleY = MINIMAP_HEIGHT / treeHeight
  const s = Math.min(scaleX, scaleY)

  const vpX = (-viewportX / scale - minX) * s
  const vpY = (-viewportY / scale - minY) * s
  const vpW = (viewportWidth / scale) * s
  const vpH = (viewportHeight / scale) * s

  return (
    <div className="absolute bottom-4 right-4 bg-card-bg/90 border border-bg-secondary rounded-lg shadow-md p-1">
      <svg width={MINIMAP_WIDTH} height={MINIMAP_HEIGHT}>
        {nodes.map((node) => (
          <circle
            key={node.personId}
            cx={(node.x - minX) * s}
            cy={(node.y - minY) * s}
            r={3}
            fill="#6b8f71"
            opacity={0.6}
          />
        ))}

        <rect
          x={vpX}
          y={vpY}
          width={Math.max(vpW, 10)}
          height={Math.max(vpH, 10)}
          fill="none"
          stroke="#3a3a3a"
          strokeWidth={1}
          opacity={0.5}
        />
      </svg>
    </div>
  )
}
