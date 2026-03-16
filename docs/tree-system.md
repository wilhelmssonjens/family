# Trädsystem

## Översikt

Horisontell trädvy renderad med D3.js i SVG. Jens & Klara i mitten, Jens släkt expanderar åt vänster, Klaras åt höger. Pan/zoom med d3-zoom.

## Nyckelfiler
- `src/components/Tree/TreeLayout.ts` — Ren funktion: `computeTreeLayout(persons, rels, centerId) → LayoutNode[]`
- `src/components/Tree/TreeView.tsx` — D3 SVG-rendering med pan/zoom
- `src/components/Tree/Minimap.tsx` — Nedskalad silhuett med viewport-rektangel
- `src/components/PersonCard/PersonCardMini.tsx` — SVG-personkort med "+"-knappar (hover)
- `src/components/PersonCard/PersonCardExpanded.tsx` — DOM-detaljkort (renderas via foreignObject)

## Layout-algoritm (TreeLayout.ts)

### Konstanter
- `HORIZONTAL_GAP = 320` — Avstånd mellan generationer (x-axel)
- `VERTICAL_GAP = 140` — Avstånd mellan syskon (y-axel)
- `PARTNER_GAP = 150` — Avstånd mellan partners i ett par

### Placering
1. Centerparet (Jens & Klara) placeras vid (±PARTNER_GAP/2, 0)
2. `expandAncestors()` kallas rekursivt för varje sida:
   - Föräldrar placeras vid `xBase = personX + direction * HORIZONTAL_GAP`
   - Y-position bestäms av `findFreeSlot()` som hittar en ledig y-position
   - Syskon placeras vertikalt under/ovanför personen
3. Barn till centerparet placeras nedanför (y > 0)

### Kollisionshantering
`findFreeSlot()` spårar upptagna y-positioner per x-kolumn och söker utåt från preferred position.

## Pan/Zoom
- d3-zoom med scaleExtent [0.3, 3]
- Centreras på Jens & Klara vid laddning
- Transform-state i React useState → SVG `<g>` transform

## Expanderat kort
Renderas som `<foreignObject>` inuti SVG transform-gruppen (följer pan/zoom).
Positioneras ovanför den klickade personens trädkoordinater.

## "+"-knappar
- Dolda med `opacity: 0`, visas vid hover via CSS (`.person-card-group:hover .add-buttons`)
- Osynlig utökad hitarea runt kortet (`transparent rect`) håller hovern aktiv
- Tre knappar: förälder (vänster), syskon (under), partner (höger)

## Hur man ändrar layouten
1. Justera konstanter i `TreeLayout.ts` (gap-värden)
2. Ändra `expandAncestors()` för ny placeringsstrategi
3. Tester i `TreeLayout.test.ts` verifierar att center, parents, siblings placeras korrekt
