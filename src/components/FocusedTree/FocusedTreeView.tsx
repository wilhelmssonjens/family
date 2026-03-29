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

/**
 * Collect the ancestor chain upward from a person.
 * Returns an array of couples (person + partner + siblings), oldest first.
 */
interface AncestorEntry {
  person: Person
  partner: Person | null
  personSiblings: Person[]
  partnerSiblings: Person[]
}

/**
 * Follow ONE parent line upward (always parents[0]).
 * Called twice — once for paternal, once for maternal — to cover both sides.
 * Deeper branches (e.g. great-grandmother's second parent) are intentionally
 * omitted to keep the focused view manageable.
 */
function collectAncestorChain(personId: string, graph: FamilyGraph): AncestorEntry[] {
  const chain: AncestorEntry[] = []
  let currentId = personId

  while (true) {
    const parents = getParents(graph, currentId)
    if (parents.length === 0) break

    const parent = parents[0]
    const otherParent = parents[1] ?? null
    const personSiblings = getSiblings(graph, parent.id).filter(s => s.id !== otherParent?.id)
    const partnerSiblings = otherParent
      ? getSiblings(graph, otherParent.id).filter(s => s.id !== parent.id)
      : []
    chain.push({ person: parent, partner: otherParent, personSiblings, partnerSiblings })
    currentId = parent.id
  }

  return chain.reverse() // oldest first
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

export function FocusedTreeView({ persons, relationships, centerId, onPersonClick }: Props) {
  const navigate = useNavigate()
  const graph = useMemo(() => buildFamilyGraph(persons, relationships), [persons, relationships])

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
    const timer = setTimeout(() => {
      document.getElementById('center-person')?.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' })
    }, 50)
    return () => clearTimeout(timer)
  }, [centerId])

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

  // Collect ancestors for each parent separately (both sides)
  const parents = getParents(graph, centerId)
  const parentPairs: AncestorEntry[] = []
  if (parents.length >= 2) {
    const p0partner = getPartners(graph, parents[0].id).find(p => p.id === parents[1].id) ? parents[1] : null
    if (p0partner) {
      parentPairs.push({
        person: parents[0],
        partner: p0partner,
        personSiblings: getSiblings(graph, parents[0].id).filter(s => s.id !== p0partner.id),
        partnerSiblings: getSiblings(graph, parents[1].id).filter(s => s.id !== parents[0].id),
      })
    } else {
      const p0 = getPartners(graph, parents[0].id)[0] ?? null
      const p1 = getPartners(graph, parents[1].id)[0] ?? null
      parentPairs.push({ person: parents[0], partner: p0, personSiblings: getSiblings(graph, parents[0].id).filter(s => s.id !== p0?.id), partnerSiblings: p0 ? getSiblings(graph, p0.id).filter(s => s.id !== parents[0].id) : [] })
      parentPairs.push({ person: parents[1], partner: p1, personSiblings: getSiblings(graph, parents[1].id).filter(s => s.id !== p1?.id), partnerSiblings: p1 ? getSiblings(graph, p1.id).filter(s => s.id !== parents[1].id) : [] })
    }
  } else if (parents.length === 1) {
    const p0 = getPartners(graph, parents[0].id)[0] ?? null
    parentPairs.push({ person: parents[0], partner: p0, personSiblings: getSiblings(graph, parents[0].id).filter(s => s.id !== p0?.id), partnerSiblings: p0 ? getSiblings(graph, p0.id).filter(s => s.id !== parents[0].id) : [] })
  }

  // Build two ancestor lines (paternal + maternal)
  const paternalChain = parents[0] ? collectAncestorChain(parents[0].id, graph) : []
  const maternalChain = parents[1] ? collectAncestorChain(parents[1].id, graph) : []

  // Merge chains into rows: zip the two chains, longest first
  const maxChainLen = Math.max(paternalChain.length, maternalChain.length)

  // Descendants: center's children + grandchildren (max 2 gen)
  const descendantGens = collectDescendantGens(centerId, graph, partners, siblings.map(s => s.id), MAX_DESCENDANT_GENS)

  // Context links beyond the visible window
  const deepestDescendants = descendantGens.length === MAX_DESCENDANT_GENS
    ? descendantGens[descendantGens.length - 1].flatMap(c => getChildren(graph, c.id))
    : []

  function handleNav(id: string) {
    navigate(`/person/${id}`)
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

        {/* === ANCESTORS (slim: just couples, no siblings) === */}
        {Array.from({ length: maxChainLen }).map((_, i) => {
          const patIdx = i - (maxChainLen - paternalChain.length)
          const matIdx = i - (maxChainLen - maternalChain.length)
          const patCouple = patIdx >= 0 ? paternalChain[patIdx] : null
          const matCouple = matIdx >= 0 ? maternalChain[matIdx] : null

          return (
            <div key={`anc-${i}`} className="flex flex-col items-center gap-1">
              {i > 0 && <div className="w-px h-2 sm:h-4 bg-card-border/30" />}
              <div className="flex items-center gap-8">
                {patCouple && (
                  <AncestorRowWithSiblings
                    couple={patCouple}
                    onNav={handleNav} onInfo={onPersonClick}
                  />
                )}
                {matCouple && patCouple && <div className="w-4" />}
                {matCouple && (
                  <AncestorRowWithSiblings
                    couple={matCouple}
                    onNav={handleNav} onInfo={onPersonClick}
                  />
                )}
              </div>
            </div>
          )
        })}

        {/* Parents row (with siblings) */}
        {parentPairs.length > 0 && (
          <>
            <div className="w-px h-2 sm:h-4 bg-card-border/30" />
            <div className="flex items-center gap-8">
              {parentPairs.map((pp) => (
                <AncestorRowWithSiblings
                  key={pp.person.id}
                  couple={pp}
                  onNav={handleNav} onInfo={onPersonClick}
                />
              ))}
            </div>
          </>
        )}

        {/* Connector to center */}
        {parents.length > 0 && <div className="w-px h-3 sm:h-5 bg-card-border/40" />}

        {/* === CENTER ROW (with siblings) === */}
        <div className="flex items-center gap-1.5 sm:gap-3 justify-center">
          {siblings.map(sib => (
            <PersonCard key={sib.id} person={sib} onNavigate={() => handleNav(sib.id)} onShowInfo={() => onPersonClick(sib.id)} />
          ))}

          <div id="center-person" className="flex items-center gap-2">
            <PersonCard person={center} isCenter onShowInfo={() => onPersonClick(centerId)} />
            {partners.map(p => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="text-accent font-sans text-lg font-light">+</span>
                <PersonCard person={p} onNavigate={() => handleNav(p.id)} onShowInfo={() => onPersonClick(p.id)} />
              </div>
            ))}
          </div>

          {partnerSiblings.map(ps => (
            <PersonCard key={ps.id} person={ps} onNavigate={() => handleNav(ps.id)} onShowInfo={() => onPersonClick(ps.id)} />
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
                <PersonCard key={child.id} person={child} onNavigate={() => handleNav(child.id)} onShowInfo={() => onPersonClick(child.id)} />
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

/** Render an ancestor couple with person's siblings on the left and partner's on the right */
function AncestorRowWithSiblings({ couple, onNav, onInfo }: {
  couple: AncestorEntry
  onNav: (id: string) => void
  onInfo: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-3">
      {couple.personSiblings.map(sib => (
        <PersonCard key={sib.id} person={sib} onNavigate={() => onNav(sib.id)} onShowInfo={() => onInfo(sib.id)} />
      ))}
      <CoupleRow person={couple.person} partner={couple.partner} onNav={onNav} onInfo={onInfo} />
      {couple.partnerSiblings.map(sib => (
        <PersonCard key={sib.id} person={sib} onNavigate={() => onNav(sib.id)} onShowInfo={() => onInfo(sib.id)} />
      ))}
    </div>
  )
}

/** Render a couple (person + optional partner) as a compact row */
function CoupleRow({ person, partner, onNav, onInfo }: {
  person: Person
  partner: Person | null
  onNav: (id: string) => void
  onInfo: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <PersonCard person={person} onNavigate={() => onNav(person.id)} onShowInfo={() => onInfo(person.id)} />
      {partner && (
        <>
          <span className="text-accent/50 font-sans text-lg">+</span>
          <PersonCard person={partner} onNavigate={() => onNav(partner.id)} onShowInfo={() => onInfo(partner.id)} />
        </>
      )}
    </div>
  )
}
