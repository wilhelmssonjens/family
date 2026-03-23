# Subtree-baserad trädlayout

## Kontext

Den nuvarande layoutalgoritmen i `TreeLayout.ts` placerar alla syskon på samma y-rad oavsett om de har egna familjer. Med 21 personer hamnar 9 kort på en enda rad (y=-300), kopplingslinjer korsas, och barn till icke-center-personer (t.ex. Hampus, son till Birgitta) visas inte alls.

Lösning: Ersätt den nuvarande platta radlayouten med en **subtree-baserad layout** där varje person med barn bildar en visuellt avgränsad **FamilyGroup** med egen breddberäkning.

## Datamodell

### FamilyGroup

```typescript
interface FamilyGroup {
  parents: string[]        // Person-IDs (1 för ensamstående, 2 för par)
  children: GroupChild[]   // Barn, ordnade vänster→höger
  width: number            // Beräknad total bredd (px)
  height: number           // Beräknad total höjd (px)
  x: number               // Placerad x-position (centrum av gruppen)
  y: number               // Placerad y-position (toppen av föräldrakortet)
}

type GroupChild =
  | { type: 'leaf'; personId: string }
  | { type: 'subgroup'; personId: string; group: FamilyGroup }
  | { type: 'backbone'; personId: string; group: FamilyGroup }
```

### Returtyp från computeTreeLayout

```typescript
interface TreeLayoutResult {
  nodes: LayoutNode[]              // Alla personkort med x/y (som idag)
  groupFrames: GroupFrame[]        // Streckade ramar för varje familjegrupp
  backboneLinks: BackboneLink[]    // Kopplingslinjer mellan grupper
}

interface GroupFrame {
  x: number; y: number; width: number; height: number
}

interface BackboneLink {
  fromPersonId: string   // Backbone-barnet i förälderns grupp
  toPersonId: string     // Samma person som förälder i sin egen grupp
  points: [number, number][]  // Linjepunkter
}
```

TreeView uppdateras att konsumera `TreeLayoutResult` istället för `LayoutNode[]`.

### Barntyper

- **leaf**: Person utan partner och utan barn i datan. Renderas som enskilt kort. (Mats, Karin, Arne, Inger, Eva, Erik, Johan)
- **subgroup**: Person som har barn (med eller utan partner) — renderas som nested FamilyGroup. (Birgitta med son Hampus — ensamstående förälder, ingen partner)
- **backbone**: Person som är direkt anfader till centerparet — som subgroup men i den "direkta linjen". Båda föräldrar till centerpersonen räknas som backbone. (Per OCH Laila är backbone till Jens; Tor OCH Lena är backbone till Klara)

### Ensamstående föräldrar

En FamilyGroup med `parents.length === 1` är giltig. Birgitta har barn (Hampus) men ingen partner. Hennes grupp:
```
{ parents: ['birgitta'], children: [{ type: 'leaf', personId: 'hampus-wikmark' }] }
```

Breddberäkningen anpassas: ensamstående förälders bredd = `CARD_WIDTH + CARD_MARGIN` (inte `PARTNER_GAP + CARD_WIDTH`).

### Backbone: binärt träd av anfäder

Varje person har upp till två föräldrar. Från centerparet expanderas **två oberoende backbone-kedjor per person**:

Från Jens:
- Paternell: Per → Gunnar → Konrad
- Maternell: Laila → Lennart

Från Klara:
- Paternell/Maternell: Tor + Lena (båda backbone)

Båda föräldrarna till en backbone-person leder till egna föräldragrupper som expanderas rekursivt.

### Fullständig barnklassificering per grupp

| Grupp | Barn | Typ |
|-------|------|-----|
| Konrad+Augusta | Gunnar | backbone |
| Gunnar+Barbro | Per (backbone), Birgitta (subgroup — har barn Hampus), Mats (leaf) |
| Lennart+Greta | Laila (backbone), Arne (leaf), Inger (leaf), Karin (leaf) |
| Per+Laila | Jens (backbone), Eva (leaf) |
| Tor+Lena | Klara (backbone), Erik (leaf), Johan (leaf) |
| Birgitta (ensam) | Hampus (leaf) |
| Jens+Klara (center) | (inga barn ännu — framtida barn placeras nedanför) |

### Backbone-personers dubbla representation

En backbone-person (t.ex. Per) visas i **två sammanhang**:
1. Som barn i sin förälders grupp (Gunnar+Barbros grupp)
2. Som förälder i sin egen grupp (Per+Lailas grupp)

Streckade kopplingslinjer (`BackboneLink`) binder ihop de två representationerna.

## Layoutalgoritm

### Fas 1: Bygg gruppträd

Utgå från centerparet (Jens+Klara) och bygg gruppstrukturen uppåt rekursivt:

1. Skapa center-grupp: Jens+Klara med eventuella barn
2. För varje person i centerparet: hitta föräldrar → skapa föräldragrupp
3. I varje föräldragrupp: klassificera barn (leaf/subgroup/backbone)
4. För backbone-barn: skapa deras egen familjegrupp (med partner och barn) rekursivt
5. För subgroup-barn: skapa deras FamilyGroup (ensamstående eller med partner)
6. Fortsätt uppåt tills inga fler föräldrar finns

### Fas 2: Bottom-up breddberäkning

Beräkna bredd rekursivt, från löven uppåt:

```
leafWidth = CARD_WIDTH + CARD_MARGIN  (160px)
subgroupWidth = barnets FamilyGroup.width

parentRowWidth:
  parents.length === 1: CARD_WIDTH + CARD_MARGIN (160px)
  parents.length === 2: PARTNER_GAP + CARD_WIDTH + CARD_MARGIN (320px)

childrenRowWidth = sum(children.map(c => c.width)) + (children.length - 1) * CHILD_GAP

groupWidth = max(parentRowWidth, childrenRowWidth) + 2 * GROUP_PADDING
```

Konstanter:
- `CARD_WIDTH`: 140px, `CARD_MARGIN`: 20px
- `PARTNER_GAP`: 160px (center-to-center mellan partners)
- `CHILD_GAP`: 40px (mellanrum mellan barn/subgrupper)
- `GENERATION_GAP`: 200px (vertikalt mellan föräldrar och barn inom grupp)
- `GROUP_PADDING`: 20px (padding inuti gruppens streckade ram)
- `BACKBONE_GAP`: 120px (vertikalt mellan en grupps backbone-barn och dess egna grupp nedanför)

### Fas 3: Top-down placering

Placera grupper med backbone-positionen som ankare:

1. **Center**: Jens+Klara vid (0, 0)
2. **Jens's föräldragrupp** (Per+Laila): ovanför center, centrerad kring Jens
   - Per placeras vänster, Laila höger (i barnraden: Jens backbone, Eva leaf)
3. **Per's föräldragrupp** (Gunnar+Barbro): ovanför Per-positionen i Per+Laila-gruppen
   - Barnrad: Mats (leaf), Birgitta (subgroup), Per (backbone) — Per längst till höger
   - Gunnar+Barbro placeras centrerat ovanför barnraden
4. **Laila's föräldragrupp** (Lennart+Greta): ovanför Laila-positionen i Per+Laila-gruppen
   - Barnrad: Laila (backbone), Arne, Inger, Karin (leaves) — Laila längst till vänster
   - Lennart+Greta centrerade ovanför
5. **Klara's föräldragrupp** (Tor+Lena): ovanför Klara-positionen, till höger
   - Barnrad: Klara (backbone), Erik, Johan (leaves)
6. **Gunnar's föräldragrupp** (Konrad+Augusta): ovanför Gunnar
7. **Birgitta's subgrupp**: renderas inline i Gunnar+Barbro-gruppens barnrad

**Riktningsregel för sub-branches:** Inom en FamilyGroup placeras backbone-barnet närmast den sida som leder mot center. Per placeras till höger i Gunnars grupp (närmare Laila-sidan). Laila placeras till vänster i Lennarts grupp (närmare Per-sidan). Övriga barn (leaves/subgroups) placeras på andra sidan.

### Fas 4: Överlappskontroll

Efter placering: kontrollera att inga grupper överlappar horisontellt. Om de gör det, skjut isär med FAMILY_GROUP_GAP (100px). Tack vare bottom-up breddberäkning bör överlapp vara sällsynt.

## Rendering

### Gruppramar
Varje FamilyGroup renderas med en subtil streckad ram (`stroke-dasharray`, färg `#d4cfc7` med låg opacity). Ensamstående föräldrars grupper (Birgitta) får en tunnare ram.

### Kopplingslinjer
- **Partner (inom grupp)**: Streckad horisontell linje (befintlig stil)
- **Förälder→barn (inom grupp)**: Bracket-linje med vertikal + horisontell spann + droppar (befintlig stil)
- **Backbone-koppling (mellan grupper)**: Streckad vertikal linje från backbone-barnets position i övre gruppen till samma persons föräldraposition i den nedre gruppen

### Backbone-markering
Backbone-barn markeras med tjockare ram och en subtil nedåtpil (↓) för att signalera att de leder vidare.

## Filer som berörs

| Fil | Ändring |
|-----|---------|
| `src/components/Tree/TreeLayout.ts` | Ny algoritm: `buildGroupTree()`, `calculateGroupWidths()`, `placeGroups()`, ny `computeTreeLayout()` som returnerar `TreeLayoutResult` |
| `src/components/Tree/TreeView.tsx` | Konsumera `TreeLayoutResult`, rendera gruppramar (`groupFrames`) och backbone-kopplingar (`backboneLinks`) |
| `src/types/index.ts` | Nya typer: `FamilyGroup`, `GroupChild`, `TreeLayoutResult`, `GroupFrame`, `BackboneLink` |
| `src/components/Tree/TreeLayout.test.ts` | Alla layouttester skrivs om för den nya algoritmen. Befintliga PersonCardMini-tester etc. oförändrade. |

## Befintlig kod som återanvänds

- `buildFamilyGraph()` i `src/utils/buildTree.ts` — graf-bygge behåller vi helt
- `PersonCardMini` — kortrenderingen är oförändrad
- `CARD_WIDTH`, `CARD_HEIGHT` — befintliga konstanter
- Pan/zoom i TreeView — oförändrat
- Modal-system (PersonModal, AddRelativeModal) — oförändrat

## Implementeringsstrategi

Implementeras i **två steg** för att möjliggöra stegvis verifiering:

1. **Steg A**: Implementera `buildGroupTree()` och `calculateGroupWidths()` som rena funktioner med egna tester. Befintlig layout fortsätter fungera.
2. **Steg B**: Implementera `placeGroups()`, uppdatera `computeTreeLayout()` till ny returtyp, uppdatera TreeView. Byt ut befintliga layouttester.

## Verifiering

1. `npx vitest run` — alla nya tester passerar (befintliga layouttester ersatta)
2. `npm run dev` — visuell kontroll:
   - Alla 21 personer synliga (inklusive Hampus)
   - Inga överlappande kort eller grupper
   - Kopplingslinjer korsar inte varandra
   - Gruppramar synliga runt varje familjegrupp
   - Backbone-linje tydlig: Jens → Per → Gunnar → Konrad och Jens → Laila → Lennart
   - Ensamstående Birgitta+Hampus visas som subgrupp
3. `npm run build` — produktionsbygge lyckas

## Framtida barn

Jens+Klaras eventuella framtida barn placeras nedanför center-gruppen (positiv y) som leaf-noder eller subgroups, precis som barn i alla andra FamilyGroups.
