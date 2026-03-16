import { getInitials } from '../../utils/formatPerson'
import type { Person } from '../../types'

interface Props {
  person: Person
  x: number
  y: number
  isExpanded?: boolean
  onClick: () => void
  onAdd?: (relationType: string) => void
}

const CARD_WIDTH = 120
const CARD_HEIGHT = 80

export function PersonCardMini({ person, x, y, isExpanded, onClick, onAdd }: Props) {
  const initials = getInitials(person.firstName, person.lastName)
  const birthYear = person.birthDate?.slice(0, 4)
  const deathYear = person.deathDate?.slice(0, 4)

  return (
    <g
      transform={`translate(${x - CARD_WIDTH / 2}, ${y - CARD_HEIGHT / 2})`}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      <rect
        width={CARD_WIDTH}
        height={CARD_HEIGHT}
        rx={8}
        fill="white"
        stroke={isExpanded ? '#4a7050' : '#6b8f71'}
        strokeWidth={isExpanded ? 2.5 : 1.5}
        filter="url(#shadow)"
      />

      <circle cx={CARD_WIDTH / 2} cy={24} r={16} fill="#eee8dc" stroke="#6b8f71" strokeWidth={1} />
      <text
        x={CARD_WIDTH / 2}
        y={28}
        textAnchor="middle"
        fontSize={11}
        fontFamily="Inter, sans-serif"
        fill="#6b8f71"
      >
        {initials}
      </text>

      <text
        x={CARD_WIDTH / 2}
        y={54}
        textAnchor="middle"
        fontSize={13}
        fontFamily="Lora, serif"
        fontWeight={600}
        fill="#3a3a3a"
      >
        {person.firstName}
      </text>

      <text
        x={CARD_WIDTH / 2}
        y={70}
        textAnchor="middle"
        fontSize={11}
        fontFamily="Inter, sans-serif"
        fill="#777"
      >
        {birthYear ?? '?'}
        {deathYear ? ` – ${deathYear}` : ''}
      </text>

      {onAdd && (
        <>
          <g transform={`translate(${-16}, ${CARD_HEIGHT / 2 - 10})`} onClick={(e) => { e.stopPropagation(); onAdd('parent') }} style={{ cursor: 'pointer' }}>
            <circle r={10} fill="#6b8f71" opacity={0.8} />
            <text textAnchor="middle" dy={4} fill="white" fontSize={14} fontFamily="sans-serif">+</text>
          </g>
          <g transform={`translate(${CARD_WIDTH / 2}, ${CARD_HEIGHT + 10})`} onClick={(e) => { e.stopPropagation(); onAdd('sibling') }} style={{ cursor: 'pointer' }}>
            <circle r={10} fill="#6b8f71" opacity={0.8} />
            <text textAnchor="middle" dy={4} fill="white" fontSize={14} fontFamily="sans-serif">+</text>
          </g>
          <g transform={`translate(${CARD_WIDTH + 16}, ${CARD_HEIGHT / 2 - 10})`} onClick={(e) => { e.stopPropagation(); onAdd('partner') }} style={{ cursor: 'pointer' }}>
            <circle r={10} fill="#c4a77d" opacity={0.8} />
            <text textAnchor="middle" dy={4} fill="white" fontSize={14} fontFamily="sans-serif">+</text>
          </g>
        </>
      )}
    </g>
  )
}

export { CARD_WIDTH, CARD_HEIGHT }
