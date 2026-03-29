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
function collectAncestorChain(personId: string, graph: FamilyGraph): { person: Person; partner: Person | null; siblings: Person[] }[] {
  const chain: { person: Person; partner: Person | null; siblings: Person[] }[] = []
  let currentId = personId

  while (true) {
    const parents = getParents(graph, currentId)
    if (parents.length === 0) break

    const parent = parents[0]
    const otherParent = parents[1] ?? null
    const partnerId = otherParent?.id
    // Get siblings of BOTH the blood-line ancestor AND their partner
    const sibs = getSiblings(graph, parent.id).filter(s => s.id !== partnerId)
    if (otherParent) {
      const partnerSibs = getSiblings(graph, otherParent.id).filter(s => s.id !== parent.id)
      sibs.push(...partnerSibs)
    }
    chain.push({ person: parent, partner: otherParent, siblings: sibs })
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

  // Zoom: ref is the source of truth, state is only for UI (buttons display)
  const [zoomUI, setZoomUI] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const zoomRef = useRef(1)
  const pinchRef = useRef<{ startDist: number; startZoom: number } | null>(null)

  // Apply zoom directly to DOM — set transformOrigin to viewport center so zoom feels natural
  function setZoomDirect(value: number) {
    zoomRef.current = value
    const content = contentRef.current
    const scrollParent = containerRef.current?.parentElement
    if (!content || !scrollParent) return
    // Transform origin = center of what's currently visible (in content coordinates)
    const ox = scrollParent.scrollLeft + scrollParent.clientWidth / 2
    const oy = scrollParent.scrollTop + scrollParent.clientHeight / 2
    content.style.transformOrigin = `${ox}px ${oy}px`
    content.style.transform = value !== 1 ? `scale(${value})` : ''
  }

  // Reset zoom + scroll center person into view on navigation
  useEffect(() => {
    setZoomDirect(1)
    setZoomUI(1)
    const timer = setTimeout(() => {
      document.getElementById('center-person')?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
    }, 50)
    return () => clearTimeout(timer)
  }, [centerId])

  const applyZoomRef = useRef<(newZoom: number, syncUI?: boolean) => void>(() => {})

  // Free-form pan (no axis locking) + focal-point zoom + momentum
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const sp = el.parentElement
    if (!sp) return
    const scrollParent: HTMLElement = sp

    // Simple zoom — transformOrigin handles focal point, no scroll adjustment
    function applyZoom(newZoom: number, syncUI = false) {
      const clamped = clamp(newZoom, MIN_ZOOM, MAX_ZOOM)
      if (clamped === zoomRef.current) return
      setZoomDirect(clamped)
      if (syncUI) setZoomUI(clamped)
    }
    applyZoomRef.current = applyZoom

    const PAN_DEAD_ZONE = 5
    let panStart: { x: number; y: number; sl: number; st: number } | null = null
    let isPanning = false
    let lastTouch: { x: number; y: number; t: number } | null = null
    let velocity = { vx: 0, vy: 0 }
    let momentumId: number | null = null
    let gestureStartZoom = 1
    let usingSafariGestures = false // prevent dual pinch handling on Safari

    function stopMomentum() {
      if (momentumId !== null) { cancelAnimationFrame(momentumId); momentumId = null }
    }

    function startMomentum() {
      const friction = 0.94
      let vx = velocity.vx * 16, vy = velocity.vy * 16
      function step() {
        if (Math.abs(vx) < 0.3 && Math.abs(vy) < 0.3) { momentumId = null; return }
        scrollParent.scrollLeft += vx
        scrollParent.scrollTop += vy
        vx *= friction; vy *= friction
        momentumId = requestAnimationFrame(step)
      }
      stopMomentum()
      momentumId = requestAnimationFrame(step)
    }

    function onTouchStart(e: TouchEvent) {
      stopMomentum()
      if (e.touches.length === 1) {
        panStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, sl: scrollParent.scrollLeft, st: scrollParent.scrollTop }
        isPanning = false
        lastTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() }
        velocity = { vx: 0, vy: 0 }
      } else if (e.touches.length === 2 && !usingSafariGestures) {
        // Only handle pinch via touch on Android (Safari uses gesture events)
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
        const now = Date.now()
        if (lastTouch) {
          const dt = now - lastTouch.t
          if (dt > 0) velocity = { vx: (lastTouch.x - x) / dt, vy: (lastTouch.y - y) / dt }
        }
        lastTouch = { x, y, t: now }
      } else if (e.touches.length === 2 && pinchRef.current && !usingSafariGestures) {
        e.preventDefault()
        const dist = getFingerDistance(e.touches[0], e.touches[1])
        applyZoom(pinchRef.current.startZoom * (dist / pinchRef.current.startDist))
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (e.touches.length === 0) {
        if (isPanning && lastTouch && Date.now() - lastTouch.t < 80) startMomentum()
        setZoomUI(zoomRef.current) // sync UI after gesture
        panStart = null; isPanning = false; lastTouch = null; pinchRef.current = null
      }
    }

    // Safari gesture events (prevents dual handling with touch events)
    function onGestureStart(e: Event) {
      e.preventDefault()
      usingSafariGestures = true
      gestureStartZoom = zoomRef.current
    }
    function onGestureChange(e: Event) {
      e.preventDefault()
      applyZoom(gestureStartZoom * (e as Event & { scale: number }).scale)
    }
    function onGestureEnd(e: Event) {
      e.preventDefault()
      setZoomUI(zoomRef.current)
    }

    // Desktop: Ctrl+wheel
    function onWheel(e: WheelEvent) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        applyZoom(zoomRef.current - e.deltaY * 0.01)
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

  const zoomIn = useCallback(() => applyZoomRef.current(zoomRef.current + ZOOM_STEP, true), [])
  const zoomOut = useCallback(() => applyZoomRef.current(zoomRef.current - ZOOM_STEP, true), [])
  const zoomReset = useCallback(() => applyZoomRef.current(1, true), [])

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
  const parentPairs: { person: Person; partner: Person | null; siblings: Person[] }[] = []
  if (parents.length >= 2) {
    const p0partner = getPartners(graph, parents[0].id).find(p => p.id === parents[1].id) ? parents[1] : null
    if (p0partner) {
      // Parents are partners — show siblings of BOTH parents
      const sibs0 = getSiblings(graph, parents[0].id).filter(s => s.id !== p0partner.id)
      const sibs1 = getSiblings(graph, parents[1].id).filter(s => s.id !== parents[0].id)
      parentPairs.push({ person: parents[0], partner: p0partner, siblings: [...sibs0, ...sibs1] })
    } else {
      parentPairs.push({ person: parents[0], partner: getPartners(graph, parents[0].id)[0] ?? null, siblings: getSiblings(graph, parents[0].id) })
      parentPairs.push({ person: parents[1], partner: getPartners(graph, parents[1].id)[0] ?? null, siblings: getSiblings(graph, parents[1].id) })
    }
  } else if (parents.length === 1) {
    parentPairs.push({ person: parents[0], partner: getPartners(graph, parents[0].id)[0] ?? null, siblings: getSiblings(graph, parents[0].id) })
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

  // Partner's parents (context link if not showing ancestors for them)
  const partnerParentLinks = partners.flatMap(p => getParents(graph, p.id))

  function handleNav(id: string) {
    navigate(`/person/${id}`)
  }

  return (
    <div ref={containerRef} className="relative" style={{ touchAction: 'none' }}>
      <div
        ref={contentRef}
        key={centerId}
        className="flex flex-col items-center gap-1 pt-[50vh] pb-[50vh] px-[50vw] min-w-fit animate-tree-enter"
        style={{ transformOrigin: 'center center' }}
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

        {/* Partner's parents context */}
        {partnerParentLinks.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="font-sans text-xs text-text-secondary mr-1">
              {partners[0]?.firstName}s föräldrar:
            </span>
            {partnerParentLinks.map(pp => (
              <button key={pp.id} onClick={() => handleNav(pp.id)}
                className="font-sans text-xs text-accent hover:underline cursor-pointer">
                {pp.firstName}
              </button>
            ))}
          </div>
        )}

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

/** Render an ancestor couple with their siblings on either side */
function AncestorRowWithSiblings({ couple, onNav, onInfo }: {
  couple: { person: Person; partner: Person | null; siblings: Person[] }
  onNav: (id: string) => void
  onInfo: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-3">
      {couple.siblings.map(sib => (
        <PersonCard key={sib.id} person={sib} onNavigate={() => onNav(sib.id)} onShowInfo={() => onInfo(sib.id)} />
      ))}
      <CoupleRow person={couple.person} partner={couple.partner} onNav={onNav} onInfo={onInfo} />
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
