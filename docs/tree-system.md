# Trädsystem

## Översikt

Horisontell trädvy renderad med D3.js i SVG. Jens & Klara i mitten, Jens släkt expanderar åt vänster, Klaras åt höger. Pan/zoom med d3-zoom.

## Nyckelfiler
- `src/components/Tree/TreeLayout.ts` — Ren funktion: `computeTreeLayout(persons, rels, centerId) → LayoutNode[]`
- `src/components/Tree/TreeView.tsx` — D3 SVG-rendering med pan/zoom
- `src/components/Tree/Minimap.tsx` — Nedskalad silhuett med viewport-rektangel
- `src/components/PersonCard/PersonCardMini.tsx` — SVG-personkort (klickbart, öppnar modal)
- `src/components/PersonCard/PersonModal.tsx` — Modal med persondetaljer, redigering och lägg-till-släkting
- `src/components/AddForm/AddRelativeModal.tsx` — Modal för att lägga till ny släkting med relationstypväljare
- `src/components/Modal/Modal.tsx` — Återanvändbar modal-komponent med backdrop och Escape-stöd

## Layout-algoritm (TreeLayout.ts)

### Konstanter
- `GENERATION_GAP = 300` — Avstånd mellan generationer (y-axel)
- `SIBLING_GAP = 250` — Avstånd mellan syskon (x-axel)
- `PARTNER_GAP = 160` — Avstånd mellan partners i ett par

### Placering
1. Centerparet (Jens & Klara) placeras vid (±PARTNER_GAP/2, 0)
2. `expandAncestors()` kallas rekursivt för varje sida:
   - Föräldrar placeras vid `xBase = personX + direction * HORIZONTAL_GAP`
   - Y-position bestäms av `findFreeSlot()` som hittar en ledig y-position
   - Syskon placeras vertikalt under/ovanför personen
3. Barn till centerparet placeras nedanför (y > 0)

### Kollisionshantering
`findFreeSlot()` spårar upptagna y-positioner per x-kolumn och söker utåt från preferred position.

## Kopplingslinjer

Alla kopplingar mellan personer ritas med **orthogonala (rätvinkliga) linjer** — inga diagonaler.

- **Partner-kopplingar**: Streckade linjer (`#c4a77d`) med 90-graders armbågar (H → V → H)
- **Förälder-barn**: SVG `<path>` med vertikala och horisontella segment (V → H → V)
- **Bracket-grupper** (flera barn): Vertikal linje från föräldracentrum till junction-Y, horisontell linje som spänner alla barn, vertikala linjer ner till varje barn

## Personkort (PersonCardMini)

- Storlek: 140×90px med rundade hörn (8px) och grön ram
- Visar: initialer (cirkel), **förnamn + efternamn** (Lora serif), födelseår/dödsår (Inter sans-serif)

## Pan/Zoom
- d3-zoom med scaleExtent [0.3, 3]
- Centreras på Jens & Klara vid laddning
- Transform-state i React useState → SVG `<g>` transform

## Personinteraktion (modal-baserad)

Klick på ett PersonCardMini-kort i trädet öppnar en centrerad modal (PersonModal) som visar all personinfo. Modalen har tre lägen:

1. **Visning**: Foto/initialer, namn, födelse/dödsinfo, yrke, berättelser, kontaktinfo. Knappar: Redigera, Lägg till släkting, Stäng.
2. **Redigering**: Alla fält blir redigerbara inline. Knappar: Spara, Avbryt.
3. **Lägg till släkting**: Öppnar AddRelativeModal med relationstypväljare (förälder/syskon/partner/barn). Två lägen:
   - **Ny person**: Kön-väljare + formulärfält (skapar ny person + relation)
   - **Befintlig person**: Sökruta som filtrerar bland alla personer (skapar bara en relation via `relationType: 'link'` i API:et)

Modaler renderas som DOM-element ovanpå SVG-trädet (inte via foreignObject), vilket ger konsekvent beteende på desktop och mobil.

## Kollisionsdetektering

`resolveOverlaps()` körs som sista steg i `computeTreeLayout`. Den grupperar noder per y-rad, sorterar per x, och skjuter isär kort som överlappar (baserat på `CARD_WIDTH + 20px` marginal). Garanterar att inga kort överlappar oavsett data.

## Fade-in-animation

Nyligen tillagda personer animeras in med en 0.5s `fadeIn`-animation (scale 0.85→1 + opacity 0→1). `highlightPersonId` skickas från App→TreeView→PersonCardMini. Animationen varar 1.5s totalt innan highlight-state rensas.

## Hur man ändrar layouten
1. Justera konstanter i `TreeLayout.ts` (gap-värden)
2. Ändra `expandAncestors()` för ny placeringsstrategi
3. `resolveOverlaps()` säkerställer att inga kort krockar
4. Tester i `TreeLayout.test.ts` verifierar att center, parents, siblings placeras korrekt och att inga kort överlappar
