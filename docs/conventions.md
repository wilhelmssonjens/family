# Kodkonventioner

## Språk
- **UI-text:** Svenska (knappar, etiketter, meddelanden)
- **Kod:** Engelska (variabelnamn, funktioner, typer, kommentarer)

## TypeScript
- Strict mode aktiverat
- Undvik `any` — använd korrekta typer
- Named exports, aldrig default (förutom App.tsx)
- Interface före type för objekt

## React
- Funktionskomponenter med hooks
- En komponent per fil
- Hooks i `src/hooks/`, utilities i `src/utils/`
- React Context för global state (ingen extern state-lib)

## Styling
- Tailwind CSS med tema-variabler i `src/index.css` (`@theme`)
- Tailwind-klasser direkt i JSX
- Färger via tema: `bg-bg-primary`, `text-accent`, `border-card-border` etc.
- Typsnitt: `font-serif` (Lora) för namn/rubriker, `font-sans` (Inter) för brödtext

## Testning
- Vitest + React Testing Library
- Testfiler bredvid källfiler: `Foo.tsx` → `Foo.test.tsx`
- Mock d3-zoom/d3-selection i SVG-komponenter (jsdom har SVG-begränsningar)
- Mock `globalThis.fetch` i tester som använder FamilyDataContext

## Commits
- Konventionell format: `feat(scope): beskrivning`, `fix(scope): ...`
- Scopes: `tree`, `card`, `search`, `gallery`, `form`, `api`, `data`, `layout`
- Co-Authored-By-rad vid AI-genererade commits

## Mobilanpassning
- Responsiv layout: alla vyer ska fungera på skärmar ner till 320px bredd
- Touch-gester: pinch-to-zoom och drag-to-pan i trädvyn via d3-zoom
- Modal → bottom sheet på mobil (`items-end`, `rounded-t-2xl`, `animate-slide-up`), centrerad dialog på desktop (`sm:items-center`, `sm:rounded-xl`)
- Swipe-to-dismiss på bottom sheet (drag ner >100px stänger)
- PersonCard: kompakta dimensioner på mobil (`w-28 sm:w-36`), full storlek på desktop
- Tap = visa info (alla kort), chevron-ikon för navigering/centrering
- Tailwind breakpoints: `sm:` (640px), `md:` (768px) — mobile-first
- `touch-action: none` på SVG för att förhindra browser-zoom-konflikter
- Testa alltid med Chrome DevTools mobile-emulering

## Filstruktur
- Max ~300 rader per fil
- Komponenter under `src/components/[Feature]/`
- Ren separation: rena funktioner i utils, sidoeffekter i hooks/contexts
