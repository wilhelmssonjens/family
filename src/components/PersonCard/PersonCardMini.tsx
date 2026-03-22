import { getInitials } from '../../utils/formatPerson'
import type { Person } from '../../types'

interface Props {
  person: Person
  x: number
  y: number
  onClick: () => void
}

const CARD_WIDTH = 120
const CARD_HEIGHT = 80

export function PersonCardMini({ person, x, y, onClick }: Props) {
  const initials = getInitials(person.firstName, person.lastName)
  const birthYear = person.birthDate?.slice(0, 4)
  const deathYear = person.deathDate?.slice(0, 4)

  return (
    <g transform={`translate(${x - CARD_WIDTH / 2}, ${y - CARD_HEIGHT / 2})`}>
      {/* Card background */}
      <rect
        width={CARD_WIDTH}
        height={CARD_HEIGHT}
        rx={8}
        fill="white"
        stroke="#6b8f71"
        strokeWidth={1.5}
        filter="url(#shadow)"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onClick() }}
        style={{ cursor: 'pointer' }}
      />

      {/* Click target over content */}
      <g
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onClick() }}
        style={{ cursor: 'pointer' }}
      >
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
      </g>
    </g>
  )
}

export { CARD_WIDTH, CARD_HEIGHT }
