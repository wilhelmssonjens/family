# Plan: Fix mobile person details click

## Problem
På mobil händer inget när man klickar på en person i trädvyn. Plus-knapparna dyker upp (via `:active` CSS), men PersonCardExpanded visas aldrig.

## Grundorsak
d3-zoom fångar `touchstart`-events på SVG:en (TreeView.tsx rad 41) för pan/zoom. När man tappar på ett personkort:
1. `touchstart` avfyras → d3-zoom börjar spåra gesten
2. d3-zoom konsumerar touch-interaktionen som en potentiell pan-gest
3. `click`-eventet på SVG-elementen i PersonCardMini avfyras aldrig (eller undertrycks)

Dessutom: den expanderade kortet renderas som `foreignObject` placerat 310px ovanför kortet — på mobilskärm kan det hamna utanför synfältet.

## Lösning

### Steg 1: Stoppa d3-zoom från att fånga touch på personkort
**Fil:** `src/components/PersonCard/PersonCardMini.tsx`

Lägg till `onPointerDown` med `stopPropagation()` på de klickbara elementen (card rect och content `<g>`). Detta förhindrar att d3-zoom fångar touchen, och låter det normala `onClick`-eventet avfyras.

Samma sak för add-button-elementen.

### Steg 2: Mobilvänlig placering av expanderat kort
**Fil:** `src/App.tsx` + ev. ny komponent/wrapper

På mobil (smal skärm) bör det expanderade personkortet visas som en fixed overlay/bottom sheet istället för en foreignObject i SVG:en. Detta löser:
- Kortet hamnar inte utanför skärmen
- Bättre touch-interaktion (DOM-element istället för foreignObject)
- Lättare att stänga (tappa utanför / stäng-knapp)

Approach:
- I `App.tsx` / `TreePage`: rendera `PersonCardExpanded` som en fixed-position overlay på mobil (under md breakpoint) istället för att skicka den som `expandedCardContent` till TreeView
- Använd Tailwind `md:hidden` / `hidden md:block` för att växla
- Behåll foreignObject-varianten för desktop

### Steg 3: CSS-förbättringar för touch
**Fil:** `src/index.css`

Uppdatera mobil-CSS:en så att plus-knapparna visas stabilt efter tap (inte bara under `:active` som försvinner direkt). Kan behöva lägga till en klass-toggle istället.

### Steg 4: Testa & verifiera
- Kör `npm run build` för att verifiera inga TypeScript-fel
- Kör `npx vitest run` för att köra befintliga tester
