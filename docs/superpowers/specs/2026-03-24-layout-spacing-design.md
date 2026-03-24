# Förbättrad layout: bottom-up bredd + sidoavgränsning

## Kontext

Nuvarande layout crammar syskon-grenar i samma riktning. Med ~40 personer och 5 generationer behövs bättre horisontell separation. Dessutom expanderar Lailas familj (Lennart+Greta-sidan) åt samma håll som Pers familj — de bör gå åt varsitt håll.

## Ändringar

### 1. Riktningsflipp för partnerns syskon (~3 rader)

I `expandAncestorsByGeneration`: när vi processar den andra personen i ett par (t.ex. Laila i Per+Laila-paret), flippa riktningen för hens syskon.

Resultat: Pers syskon (Birgitta, Mats) → VÄNSTER, Lailas syskon (Arne, Inger, Karin) → HÖGER.

Samma princip rekursivt: varje pars respektive föräldrars syskon sprids åt varsitt håll.

### 2. Bottom-up subträdsbredd (~40 rader)

Ny funktion `spreadBySubtreeWidth(nodes, graph)` som körs EFTER `placeDescendants` men FÖRE `resolveOverlaps`.

Algoritm:
1. Bygg förälder→barn-mapping från placerade noder
2. Bottom-up: beräkna varje nods subträds-bredd (leaf = CARD_WIDTH + CARD_MARGIN, förälder = summa av barns bredder + gap)
3. Top-down: omfördela barns x-positioner proportionellt till subträdsbredder, centrerade under föräldern

### 3. Sidoavgränsning: Jens vänster, Klara höger

**Regel:** Jens-sidans noder ska aldrig ha x > 0, Klara-sidans noder ska aldrig ha x < 0. Centerparet (Jens+Klara) sitter vid gränsen.

Implementeras som en constraint i `resolveOverlaps` eller som post-processing.

### 4. Lägg till ~20 nya personer i datan

Nya personer och relationer enligt användarens specifikation (se data nedan).

## Nya personer att lägga till

| Person | Partner | Barn | Notering |
|--------|---------|------|----------|
| Alf (Birgittas partner) | Birgitta | — | Ej far till Hampus/Jacob |
| Jacob (Birgittas son) | Karolina | Agnes | |
| Linnea (Hampus partner) | Hampus | Knut | |
| Anne (Mats partner) | Mats | — | Ej mamma till Madeleine/Robert |
| Madeleine (Mats dotter) | — | — | Anne ej mamma |
| Robert (Mats son) | — | — | Anne ej mamma |
| Gunnel Johansson (Arnes partner) | Arne | Mikael, Maria | |
| Mikael Johansson | — | — | |
| Maria Johansson | — | — | |
| Johnny Sand (Ingers partner) | Inger | Johan S, David S, Anna S | |
| Johan Sand | — | — | |
| David Sand | — | — | |
| Anna Sand | — | — | |
| Karolina (Jacobs partner) | Jacob | Agnes | |
| Agnes (Jacobs dotter) | — | — | |
| Linnea (Hampus partner) | Hampus | Knut | |
| Knut (Hampus son) | — | — | |

## Filer som ändras

| Fil | Ändring |
|-----|---------|
| `src/components/Tree/TreeLayout.ts` | Riktningsflipp + spreadBySubtreeWidth + sidoavgränsning |
| `src/components/Tree/TreeLayout.test.ts` | Tester för nya funktioner |
| `public/data/persons.json` | ~15 nya personer |
| `public/data/relationships.json` | ~20 nya relationer |

## Verifiering

1. `npx vitest run` — alla tester passerar
2. `npm run dev` — visuellt: Jens-sida vänster, Klara-sida höger, tydlig separation, inga överlapp, ~40 personer synliga
