import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { PersonCard } from './PersonCard'
import type { Person, Relationship } from '../../types'
import { buildFamilyGraph, getParents, getChildren, getSiblings, getPartners } from '../../utils/buildTree'
import type { FamilyGraph } from '../../utils/buildTree'

interface Props {
  persons: Person[]
  relationships: Relationship[]
  centerId: string
  onPersonClick: (personId: string) => void
  onAddRelative: (personId: string) => void
}

// Max generations to show below center (center's children + grandchildren)
const MAX_DESCENDANT_GENS = 2
const MIN_ZOOM = 0.4
const MAX_ZOOM = 2.5
const ZOOM_STEP = 0.15
// Padding around tree content — ~4 card heights vertically, ~4 card widths horizontally
const CARD_PADDING_V = 480
const CARD_PADDING_H = 560

function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max)
}

function getFingerDistance(t1: Touch, t2: Touch) {
  const dx = t1.clientX - t2.clientX
  const dy = t1.clientY - t2.clientY
  return Math.sqrt(dx * dx + dy * dy)
}

const MAX_ANCESTOR_GENS = 10

/** Get parent couple for a person. Returns null if no parents. */
function getParentCouple(personId: string, graph: FamilyGraph): { person: Person; partner: Person | null } | null {
  const parents = getParents(graph, personId)
  if (parents.length === 0) return null
  const p0 = parents[0]
  const p1 = parents[1] ?? getPartners(graph, p0.id)[0] ?? null
  return { person: p0, partner: p1 }
}

/**
 * Render a person with their siblings, with their parents' CoupleBranch centered above.
 * side='left': siblings first, person last (closest to + sign)
 * side='right': person first, siblings after
 */
function PersonWithAncestors({ person, graph, cardProps, depth, side, excludeFromSiblings }: {
  person: Person
  graph: FamilyGraph
  cardProps: CardPropsFn
  depth: number
  side: 'left' | 'right'
  excludeFromSiblings?: string
}) {
  const siblings = getSiblings(graph, person.id).filter(s => s.id !== excludeFromSiblings)
  const parentCouple = depth < MAX_ANCESTOR_GENS ? getParentCouple(person.id, graph) : null

  return (
    <div className="flex flex-col items-center gap-1">
      {parentCouple && (
        <>
          <CoupleBranch
            person={parentCouple.person}
            partner={parentCouple.partner}
            graph={graph}
            cardProps={cardProps}
            depth={depth + 1}
          />
          <div className="w-px h-2 sm:h-4 bg-card-border/30" />
        </>
      )}
      <div className="flex items-center gap-1.5 sm:gap-3">
        {side === 'left' ? (
          <>
            {siblings.map(sib => (
              <PersonCard key={sib.id} person={sib} {...cardProps(sib.id)} />
            ))}
            <PersonCard person={person} {...cardProps(person.id)} />
          </>
        ) : (
          <>
            <PersonCard person={person} {...cardProps(person.id)} />
            {siblings.map(sib => (
              <PersonCard key={sib.id} person={sib} {...cardProps(sib.id)} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}

/** Render a couple: two PersonWithAncestors side by side with + between */
function CoupleBranch({ person, partner, graph, cardProps, depth }: {
  person: Person
  partner: Person | null
  graph: FamilyGraph
  cardProps: CardPropsFn
  depth: number
}) {
  return (
    <div className="flex items-end">
      <PersonWithAncestors
        person={person}
        graph={graph}
        cardProps={cardProps}
        depth={depth}
        side="left"
        excludeFromSiblings={partner?.id}
      />
      {partner && (
        <>
          <span className="text-accent/50 font-sans text-lg px-1 sm:px-2 self-end pb-2">+</span>
          <PersonWithAncestors
            person={partner}
            graph={graph}
            cardProps={cardProps}
            depth={depth}
            side="right"
            excludeFromSiblings={person.id}
          />
        </>
      )}
    </div>
  )
}

/**
 * Collect descendant generations below a person.
 * Returns arrays of children per generation, max `maxGens` levels deep.
 * Only follows the CENTER person's direct children, not siblings' children.
 */
function collectDescendantGens(
  personId: string,
  graph: FamilyGraph,
  partners: Person[],
  siblingIds: string[],
  maxGens: number,
): Person[][] {
  const result: Person[][] = []

  // First gen: children of center + partners + siblings (+ their partners)
  const firstGenParentIds = [personId, ...partners.map(p => p.id)]
  for (const sibId of siblingIds) {
    firstGenParentIds.push(sibId)
    for (const sp of getPartners(graph, sibId)) {
      if (!firstGenParentIds.includes(sp.id)) firstGenParentIds.push(sp.id)
    }
  }

  let currentParentIds = firstGenParentIds

  for (let gen = 0; gen < maxGens; gen++) {
    const childSet = new Set<string>()
    const children: Person[] = []

    for (const pid of currentParentIds) {
      for (const child of getChildren(graph, pid)) {
        if (!childSet.has(child.id)) {
          childSet.add(child.id)
          children.push(child)
        }
      }
    }

    if (children.length === 0) break
    result.push(children)

    // Next generation: all these children become parents
    currentParentIds = children.map(c => c.id)
    for (const child of children) {
      for (const cp of getPartners(graph, child.id)) {
        if (!currentParentIds.includes(cp.id)) currentParentIds.push(cp.id)
      }
    }
  }

  return result
}

export function FocusedTreeView({ persons, relationships, centerId, onPersonClick, onAddRelative }: Props) {
  const navigate = useNavigate()
  const graph = useMemo(() => buildFamilyGraph(persons, relationships), [persons, relationships])

  // Flip-card: track which card is expanded (only one at a time)
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null)

  // Zoom: ref is source of truth, state only for UI display
  const [zoomUI, setZoomUI] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const zoomRef = useRef(1)
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(null)
  const momentumIdRef = useRef<number | null>(null)

  // Focal-point zoom: adjusts scroll so the point stays stationary on screen
  const applyZoomAtPointRef = useRef<(newZoom: number, fx: number, fy: number, syncUI?: boolean) => void>(() => {})

  // Reset zoom + center on navigation. Instant scroll to avoid fighting with CSS animation.
  useEffect(() => {
    if (momentumIdRef.current !== null) { cancelAnimationFrame(momentumIdRef.current); momentumIdRef.current = null }
    zoomRef.current = 1
    if (contentRef.current) contentRef.current.style.transform = 'scale(1)'
    setZoomUI(1)
    setExpandedPersonId(null)
    const timer = setTimeout(() => {
      document.getElementById('center-person')?.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' })
    }, 50)
    return () => clearTimeout(timer)
  }, [centerId])

  // Click-outside handler: collapse expanded card when clicking elsewhere
  useEffect(() => {
    if (!expandedPersonId) return
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      const target = e.target as HTMLElement
      if (!target.closest('[data-expanded-card]')) {
        setExpandedPersonId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [expandedPersonId])

  // Free-form pan + focal-point zoom + momentum
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const sp = el.parentElement
    if (!sp) return
    const scrollParent: HTMLElement = sp

    // transform: scale() with will-change to keep compositing layer stable.
    // Always use scale(x) — never empty string — to avoid layer churn blink.
    function applyZoom(newZoom: number, fx: number, fy: number, syncUI = false) {
      const content = contentRef.current
      if (!content) return
      const oldZoom = zoomRef.current
      const clamped = clamp(newZoom, MIN_ZOOM, MAX_ZOOM)
      if (clamped === oldZoom) return
      const ratio = clamped / oldZoom
      const newSL = (scrollParent.scrollLeft + fx) * ratio - fx
      const newST = (scrollParent.scrollTop + fy) * ratio - fy
      zoomRef.current = clamped
      content.style.transform = `scale(${clamped})`
      scrollParent.scrollLeft = Math.max(0, newSL)
      scrollParent.scrollTop = Math.max(0, newST)
      if (syncUI) setZoomUI(clamped)
    }
    applyZoomAtPointRef.current = applyZoom

    const PAN_DEAD_ZONE = 5
    const VELOCITY_SMOOTHING = 0.7
    let panStart: { x: number; y: number; sl: number; st: number } | null = null
    let isPanning = false
    let lastTouch: { x: number; y: number; t: number } | null = null
    let velocity = { vx: 0, vy: 0 }
    let gestureStartZoom = 1
    let usingSafariGestures = false

    function stopMomentum() {
      if (momentumIdRef.current !== null) { cancelAnimationFrame(momentumIdRef.current); momentumIdRef.current = null }
    }

    function startMomentum() {
      const friction = 0.94
      const MAX_VELOCITY = 25
      let vx = clamp(velocity.vx * 16, -MAX_VELOCITY, MAX_VELOCITY)
      let vy = clamp(velocity.vy * 16, -MAX_VELOCITY, MAX_VELOCITY)
      function step() {
        if (Math.abs(vx) < 0.3 && Math.abs(vy) < 0.3) { momentumIdRef.current = null; return }
        scrollParent.scrollLeft += vx
        scrollParent.scrollTop += vy
        vx *= friction; vy *= friction
        momentumIdRef.current = requestAnimationFrame(step)
      }
      stopMomentum()
      momentumIdRef.current = requestAnimationFrame(step)
    }

    function initPanFromTouch(touch: Touch) {
      panStart = { x: touch.clientX, y: touch.clientY, sl: scrollParent.scrollLeft, st: scrollParent.scrollTop }
      isPanning = false
      lastTouch = { x: touch.clientX, y: touch.clientY, t: Date.now() }
      velocity = { vx: 0, vy: 0 }
    }

    function onTouchStart(e: TouchEvent) {
      stopMomentum()
      if (e.touches.length === 1) {
        initPanFromTouch(e.touches[0])
      } else if (e.touches.length === 2 && !usingSafariGestures) {
        e.preventDefault()
        panStart = null; isPanning = false
        pinchRef.current = { startDist: getFingerDistance(e.touches[0], e.touches[1]), startZoom: zoomRef.current }
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (e.touches.length === 1 && panStart) {
        const x = e.touches[0].clientX, y = e.touches[0].clientY
        const dx = panStart.x - x, dy = panStart.y - y
        if (!isPanning && Math.abs(dx) < PAN_DEAD_ZONE && Math.abs(dy) < PAN_DEAD_ZONE) return
        isPanning = true
        e.preventDefault()
        scrollParent.scrollLeft = panStart.sl + dx
        scrollParent.scrollTop = panStart.st + dy
        // [I1] Smoothed velocity for reliable momentum
        const now = Date.now()
        if (lastTouch) {
          const dt = now - lastTouch.t
          if (dt > 0) {
            const instantVx = (lastTouch.x - x) / dt
            const instantVy = (lastTouch.y - y) / dt
            velocity = {
              vx: velocity.vx * VELOCITY_SMOOTHING + instantVx * (1 - VELOCITY_SMOOTHING),
              vy: velocity.vy * VELOCITY_SMOOTHING + instantVy * (1 - VELOCITY_SMOOTHING),
            }
          }
        }
        lastTouch = { x, y, t: now }
      } else if (e.touches.length === 2 && pinchRef.current && !usingSafariGestures) {
        e.preventDefault()
        const dist = getFingerDistance(e.touches[0], e.touches[1])
        const rect = scrollParent.getBoundingClientRect()
        const fx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left
        const fy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top
        applyZoom(pinchRef.current.startZoom * (dist / pinchRef.current.startDist), fx, fy)
      }
    }

    // [C3] Handle pinch-to-pan transition: re-init pan from remaining finger
    function onTouchEnd(e: TouchEvent) {
      if (e.touches.length === 0) {
        if (isPanning && lastTouch && Date.now() - lastTouch.t < 80) startMomentum()
        setZoomUI(zoomRef.current) // sync UI after all fingers lifted
        panStart = null; isPanning = false; lastTouch = null; pinchRef.current = null
      } else if (e.touches.length === 1) {
        // One finger remaining after pinch — seamlessly continue as pan
        setZoomUI(zoomRef.current) // sync UI after pinch ends
        pinchRef.current = null
        initPanFromTouch(e.touches[0])
      }
    }

    // Safari gesture events
    function onGestureStart(e: Event) {
      e.preventDefault()
      usingSafariGestures = true
      gestureStartZoom = zoomRef.current
    }
    function onGestureChange(e: Event) {
      e.preventDefault()
      const ge = e as Event & { scale: number; clientX?: number; clientY?: number }
      const rect = scrollParent.getBoundingClientRect()
      const fx = ge.clientX != null ? ge.clientX - rect.left : scrollParent.clientWidth / 2
      const fy = ge.clientY != null ? ge.clientY - rect.top : scrollParent.clientHeight / 2
      applyZoom(gestureStartZoom * ge.scale, fx, fy)
    }
    function onGestureEnd(e: Event) {
      e.preventDefault()
      usingSafariGestures = false
      setZoomUI(zoomRef.current) // sync UI after gesture ends
    }

    // [S2] Desktop: Ctrl+wheel with deltaMode normalization
    function onWheel(e: WheelEvent) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        let delta = e.deltaY
        if (e.deltaMode === 1) delta *= 16
        if (e.deltaMode === 2) delta *= 100
        const rect = scrollParent.getBoundingClientRect()
        applyZoom(zoomRef.current - delta * 0.005, e.clientX - rect.left, e.clientY - rect.top)
      }
    }

    el.addEventListener('gesturestart', onGestureStart, { passive: false })
    el.addEventListener('gesturechange', onGestureChange, { passive: false })
    el.addEventListener('gestureend', onGestureEnd, { passive: false })
    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      stopMomentum()
      el.removeEventListener('gesturestart', onGestureStart)
      el.removeEventListener('gesturechange', onGestureChange)
      el.removeEventListener('gestureend', onGestureEnd)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('wheel', onWheel)
    }
  }, [])

  const zoomIn = useCallback(() => {
    const sp = containerRef.current?.parentElement
    if (sp) applyZoomAtPointRef.current(zoomRef.current + ZOOM_STEP, sp.clientWidth / 2, sp.clientHeight / 2, true)
  }, [])
  const zoomOut = useCallback(() => {
    const sp = containerRef.current?.parentElement
    if (sp) applyZoomAtPointRef.current(zoomRef.current - ZOOM_STEP, sp.clientWidth / 2, sp.clientHeight / 2, true)
  }, [])
  const zoomReset = useCallback(() => {
    const sp = containerRef.current?.parentElement
    if (sp) applyZoomAtPointRef.current(1, sp.clientWidth / 2, sp.clientHeight / 2, true)
  }, [])

  const center = persons.find(p => p.id === centerId)
  if (!center) {
    return <div className="flex-1 flex items-center justify-center font-sans text-text-secondary">Personen hittades inte</div>
  }

  const partners = getPartners(graph, centerId)
  const siblings = getSiblings(graph, centerId)
  const partnerSiblings = partners.flatMap(p =>
    getSiblings(graph, p.id).filter(s => s.id !== centerId)
  )

  // Center's parent couple (entry point for recursive ancestor branches)
  const parents = getParents(graph, centerId)
  const parentCouple = parents.length > 0 ? getParentCouple(centerId, graph) : null

  // Descendants: center's children + grandchildren (max 2 gen)
  const descendantGens = collectDescendantGens(centerId, graph, partners, siblings.map(s => s.id), MAX_DESCENDANT_GENS)

  // Context links beyond the visible window
  const deepestDescendants = descendantGens.length === MAX_DESCENDANT_GENS
    ? descendantGens[descendantGens.length - 1].flatMap(c => getChildren(graph, c.id))
    : []

  function handleNav(id: string) {
    setExpandedPersonId(null)
    navigate(`/person/${id}`)
  }

  function handleShowInfo(id: string) {
    setExpandedPersonId(null)
    onPersonClick(id)
  }

  function handleAddRelative(id: string) {
    setExpandedPersonId(null)
    onAddRelative(id)
  }

  function cardProps(id: string, isCenter = false) {
    return {
      isCenter,
      isExpanded: expandedPersonId === id,
      onExpand: () => setExpandedPersonId(expandedPersonId === id ? null : id),
      onNavigate: isCenter ? undefined : () => handleNav(id),
      onShowInfo: () => handleShowInfo(id),
      onAddRelative: () => handleAddRelative(id),
    }
  }

  return (
    <div ref={containerRef} className="relative select-none" style={{ touchAction: 'none' }}>
      {/* Animation wrapper — separate from zoom element to avoid transform conflicts */}
      <div key={centerId} className="animate-tree-enter">
      <div
        ref={contentRef}
        className="flex flex-col items-center gap-1 min-w-fit"
        style={{ padding: `${CARD_PADDING_V}px ${CARD_PADDING_H}px`, transform: 'scale(1)', transformOrigin: '0 0', willChange: 'transform' }}
      >

        {/* === ANCESTORS (recursive — each person with siblings, parents centered above) === */}
        {parentCouple && (
          <CoupleBranch
            person={parentCouple.person}
            partner={parentCouple.partner}
            graph={graph}
            cardProps={cardProps}
            depth={0}
          />
        )}

        {/* Connector to center */}
        {parents.length > 0 && <div className="w-px h-3 sm:h-5 bg-card-border/40" />}

        {/* === CENTER ROW (with siblings) === */}
        <div className="flex items-center gap-1.5 sm:gap-3 justify-center">
          {siblings.map(sib => (
            <PersonCard key={sib.id} person={sib} {...cardProps(sib.id)} />
          ))}

          <div id="center-person" className="flex items-center gap-2">
            <PersonCard person={center} {...cardProps(centerId, true)} />
            {partners.map(p => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="text-accent font-sans text-lg font-light">+</span>
                <PersonCard person={p} {...cardProps(p.id)} />
              </div>
            ))}
          </div>

          {partnerSiblings.map(ps => (
            <PersonCard key={ps.id} person={ps} {...cardProps(ps.id)} />
          ))}
        </div>

        {/* Partner's parents context — grouped per partner */}
        {partners.map(partner => {
          const pParents = getParents(graph, partner.id)
          if (pParents.length === 0) return null
          return (
            <div key={partner.id} className="flex items-center gap-1">
              <span className="font-sans text-xs text-text-secondary mr-1">
                {partner.firstName}s föräldrar:
              </span>
              {pParents.map(pp => (
                <button key={pp.id} onClick={() => handleNav(pp.id)}
                  className="font-sans text-xs text-accent hover:underline cursor-pointer">
                  {pp.firstName}
                </button>
              ))}
            </div>
          )
        })}

        {/* === DESCENDANTS (center's children + grandchildren) === */}
        {descendantGens.map((gen, genIdx) => (
          <div key={`desc-${genIdx}`} className="flex flex-col items-center gap-1">
            <div className="w-px h-3 sm:h-5 bg-card-border/40" />
            <div className="flex items-center gap-1.5 sm:gap-3 justify-center">
              {gen.map(child => (
                <PersonCard key={child.id} person={child} {...cardProps(child.id)} />
              ))}
            </div>
          </div>
        ))}

        {/* Context links below (beyond max descendant gens) */}
        {deepestDescendants.length > 0 && (
          <>
            <div className="w-px h-3 bg-card-border/30" />
            <div className="flex gap-4 justify-center">
              {deepestDescendants.map(p => (
                <button key={p.id} onClick={() => handleNav(p.id)}
                  className="font-sans text-xs text-accent hover:underline cursor-pointer">
                  {p.firstName} {p.lastName}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Empty state */}
        {parents.length === 0 && partners.length === 0 && descendantGens.length === 0 && (
          <p className="font-sans text-sm text-text-secondary mt-4">
            Klicka på {center.firstName} för att lägga till familjemedlemmar.
          </p>
        )}
      </div>
      </div>{/* close animate-tree-enter wrapper */}

      {/* Zoom controls */}
      <div className="fixed bottom-20 sm:bottom-6 right-3 flex flex-col gap-2 z-40">
        <button
          onClick={zoomIn}
          className="w-10 h-10 rounded-full bg-card-bg border border-card-border/40 shadow-md
                     flex items-center justify-center text-text-primary font-sans text-lg
                     hover:bg-accent hover:text-white active:scale-90 transition-all cursor-pointer"
          aria-label="Zooma in"
        >
          +
        </button>
        <button
          onClick={zoomOut}
          className="w-10 h-10 rounded-full bg-card-bg border border-card-border/40 shadow-md
                     flex items-center justify-center text-text-primary font-sans text-lg
                     hover:bg-accent hover:text-white active:scale-90 transition-all cursor-pointer"
          aria-label="Zooma ut"
        >
          &minus;
        </button>
        {zoomUI !== 1 && (
          <button
            onClick={zoomReset}
            className="w-10 h-10 rounded-full bg-card-bg border border-card-border/40 shadow-md
                       flex items-center justify-center text-text-secondary font-sans text-[10px]
                       hover:bg-accent hover:text-white active:scale-90 transition-all cursor-pointer"
            aria-label="Återställ zoom"
          >
            {Math.round(zoomUI * 100)}%
          </button>
        )}
      </div>
    </div>
  )
}

type CardPropsFn = (id: string, isCenter?: boolean) => {
  isCenter: boolean
  isExpanded: boolean
  onExpand: () => void
  onNavigate: (() => void) | undefined
  onShowInfo: () => void
  onAddRelative: () => void
}

