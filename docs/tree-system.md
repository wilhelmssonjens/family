# Trädsystem

## Översikt

Horisontell trädvy renderad med D3.js i SVG. Jens & Klara i mitten, Jens släkt expanderar åt vänster, Klaras åt höger. Pan/zoom med d3-zoom.

## Arkitektur (v3 family-first)

Layoutmotorn är uppdelad i moduler med en tydlig pipeline:

```
buildFamilyUnits → pickCenterFamily → assignGenerations → measureAllV3 → placeFamilyV3/placeAncestorsV3 → validateLayoutResult → LayoutResultV3
```

**Nyckelprinciper:**
- **Familjen är layoutens enda enhet** — all placering utgår från `FamilyUnit`, inte enskilda personer
- **Visuell instansmodell** — samma person kan förekomma i flera familjekontexter (t.ex. som förälder i två familjer)
- **Deterministisk** — all sortering och val är stabilt och reproducerbart
- **Hård validering** — oplacerade noder och överlapp ger fel i dev/test

## Nyckelfiler

### Layout-pipeline
- `src/components/Tree/computeTreeLayoutV3.ts` — Orkestrator: `computeTreeLayoutV3(persons, rels, centerId) → LayoutResultV3`
- `src/components/Tree/familySelection.ts` — `pickCenterFamily()` (returnerar FamilyUnit), `pickPrimaryBirthFamily()`
- `src/components/Tree/assignGenerations.ts` — BFS-generationstilldelning, enda sanningskälla för generationer
- `src/components/Tree/measureLayout.ts` — Bottom-up familjemätning med per-familyId memoization
- `src/components/Tree/placeLayout.ts` — Top-down placering med visuella instanser (`VisualPersonNode`)
- `src/components/Tree/validateLayout.ts` — Hård validering: överlapp, saknade noder, duplicerade IDs
- `src/components/Tree/TreeLayout.ts` — Barrel-fil som re-exporterar alla v3-moduler

### Rendering
- `src/components/Tree/TreeView.tsx` — D3 SVG-rendering med pan/zoom, konsumerar `LayoutResultV3`
- `src/components/Tree/Minimap.tsx` — Nedskalad silhuett med viewport-rektangel
- `src/components/PersonCard/PersonCardMini.tsx` — SVG-personkort (klickbart, öppnar modal)

### Interaktion
- `src/components/PersonCard/PersonModal.tsx` — Modal med persondetaljer, redigering och lägg-till-släkting
- `src/components/AddForm/AddRelativeModal.tsx` — Modal för att lägga till ny släkting
- `src/components/Modal/Modal.tsx` — Återanvändbar modal-komponent

## Layout-pipeline i detalj

### 1. buildFamilyUnits (buildTree.ts)
Bygger `FamilyUnit[]` från personer och relationer. Varje FamilyUnit grupperar en föräldrauppsättning (1-2 föräldrar) med deras gemensamma barn. Deterministisk sortering via födelseår → id.

### 2. pickCenterFamily (familySelection.ts)
Returnerar faktisk `FamilyUnit` (inte partner-id). Urvalsordning: parent-familj föredras → flest barn → tvåförälder → tidigaste barns födelseår → familyId.

### 3. assignGenerations (assignGenerations.ts)
BFS från centerperson. Center = 0, föräldrar = -1, barn = +1. Partners delar alltid generation. Enda sanningskälla.

### 4. measureAllV3 (measureLayout.ts)
Bottom-up mätning. Returnerar tre maps: `familyWidths`, `personWidths`, `ancestorWidths`.

**Nyckelskillnad:** person med flera parent-familjer (omgifte) → bredd = **summa** av familjers bredd (inte max). Per-familyId memoization, inget delat visited-set.

### 5. Placement (placeLayout.ts)
- `placeFamilyV3()` — placerar familjeblock: föräldrar centrerade, barn distribuerade under
- `placeAncestorsV3()` — expanderar ancestors i **samma riktning** som föräldranoden (vänster för Jens-sidan, höger för Klaras)
- Skapar `VisualPersonNode` med unikt `visualId` (format: `p:${personId}@f:${familyId}:${role}`) och `branch` (`left`/`center`/`right`)
- Familjenivå-dedup (inte personnivå) — samma person kan placeras i flera familjekontexter
- **Fast partnerGap** — branch-resolvern hanterar överlapp

### 5b. resolveFamilyGrouping (placeLayout.ts)
Per y-nivå: grupperar syskon med samma födelsefamilj och säkerställer att varje grupp är sammanhängande. Förhindrar att t.ex. Gunnars barn (Per, Birgitta, Mats) blandas med Lennarts barn (Laila, Arne, Inger). Opererar per rad utan descendant-propagering.

### 5c. resolveRowOverlaps (placeLayout.ts)
Branch-medveten post-processing. Varje visuell nod taggas med en `branch` (`'left'` | `'center'` | `'right'`) baserat på vilken ancestorkedja den placerades under:
- `left`: Jens ancestors (steg 10)
- `center`: Centerparet + deras gemensamma barn (steg 8-9)
- `right`: Klaras ancestors (steg 11)

Resolvern säkerställer att right-branch noder aldrig interfolieras med left/center-noder. Left+center behåller sina positioner, right-gruppen skjuts åt höger om den överlappar. Extra 40px gap vid branch-gräns. Samma person med dubbla instanser behålls på samma x.

### 6. validateLayoutResult (validateLayout.ts)
Kontrollerar: inga duplicerade visualIds, finite x/y, giltiga connector-referenser, inga överlapp. Kastar Error i dev/test, console.warn i prod.

## Konstanter
- `GENERATION_GAP = 250` — Avstånd mellan generationer (y-axel)
- `PARTNER_GAP = 160` — Avstånd mellan partners i ett par
- `CHILD_GAP = 60` — Avstånd mellan syskon (x-axel)
- `CARD_WIDTH = 140`, `CARD_HEIGHT = 90` — Kortdimensioner
- `CARD_MARGIN = 20` — Marginal runt kort

## Kopplingslinjer

Alla kopplingar ritas med **orthogonala (rätvinkliga) linjer** — inga diagonaler.

- **Partner-kopplingar**: Streckade linjer (`#c4a77d`) med 90-graders armbågar
- **Förälder-barn**: SVG `<path>` med vertikala och horisontella segment
- **Bracket-grupper** (flera barn): Vertikal linje → horisontell spännlinje → vertikala linjer ner
- **Linje-separation**: Familjer med samma parentY/childY får stegvis y-offset (6px per familj) för att undvika att horisontella bracket-linjer överlappar varandra

Connector-data kommer direkt från `PositionedFamilyConnectorV3` i layoutresultatet — TreeView rekonstruerar aldrig familjer.

## Personkort (PersonCardMini)

- Storlek: 140×90px med rundade hörn (8px) och grön ram
- Visar: initialer (cirkel), **förnamn + efternamn** (Lora serif), födelseår/dödsår (Inter sans-serif)

## Pan/Zoom
- d3-zoom med scaleExtent [0.3, 3]
- Centreras på Jens & Klara vid laddning
- Transform-state i React useState → SVG `<g>` transform

## Personinteraktion (modal-baserad)

### Interaktionsmodell (FocusedTreeView)

**Alla kort:** Tap öppnar PersonModal (info-vy). Enhetligt beteende oavsett center/non-center.

**Navigering/centrering:** Liten chevron-ikon (›) i övre högra hörnet på non-center kort. Synlig med `opacity-40` på mobil, `opacity-0 → group-hover:opacity-100` på desktop.

**Modal på mobil:** Bottom sheet som glider upp från botten (`animate-slide-up`). Drag handle (grå pille) ovanför innehållet. Swipe ner (>100px) stänger. På desktop: centrerad dialog som tidigare.

### PersonModal — en vy, allt inline-redigerbart

Ingen separat "redigera-mode" — alla fält redigeras direkt i samma vy:

- **Namn** i header: tap → inline inputs (förnamn + efternamn). Blur/Enter sparar lokalt.
- **Foto** i header: tap → öppnar filväljare. Foto-sektion under fälten visar thumbnails + upload-knapp + ta bort.
- **Textfält** (`EditableDetailRow`): tap → fältet blir en input. Tomma fält visar "+ Lägg till".
- **Stories** (`EditableStory`): tap → inline redigering av rubrik + text. "+ Lägg till" och "Ta bort" per story.
- **Radera person**: röd länk längst ner med confirm-dialog.
- **Auto-save:** `dirty`-flagga spårar ändringar. Vid stängning anropas `onSave(formState)` automatiskt.
- Footer: "Lägg till släkting" + "Visa i trädet" (non-center).
- **Lägg till släkting**: Öppnar AddRelativeModal med relationstypväljare.

## Fade-in-animation

Nyligen tillagda personer animeras in med en 0.5s `fadeIn`-animation (scale 0.85→1 + opacity 0→1). `highlightPersonId` skickas från App→TreeView→PersonCardMini.

## Teststruktur

| Fil | Tester | Ansvar |
|-----|--------|--------|
| `computeTreeLayoutV3.test.ts` | 27 | Integration: center, ancestors, overlaps, multi-partner, half-siblings, partner-gap, layout-width, branch-separation |
| `assignGenerations.test.ts` | 10 | BFS-generationer, getGeneration |
| `measureLayout.test.ts` | 13 | Familjemätning, multi-familj summa, ordningsoberoende |
| `familySelection.test.ts` | 10 | pickCenterFamily, pickPrimaryBirthFamily |
| `validateLayout.test.ts` | 10 | Validering: duplicerade ids, överlapp, saknade noder |
| `TreeLayout.test.ts` | 3 | Barrel re-export-verifiering |

## Hur man ändrar layouten
1. Justera konstanter i `measureLayout.ts` (via `defaultLayoutConfig()`)
2. Ändra `placeAncestorsV3()` för ny placeringsstrategi
3. `validateLayoutResult()` säkerställer att inga kort krockar
4. Tester i `computeTreeLayoutV3.test.ts` verifierar alla invarianter
