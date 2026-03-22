# Familjen — Släkthemsida

## Vad
Interaktiv släkthemsida centrerad kring Jens & Klara. Horisontellt trädvy med pan/zoom, personkort, sök, galleri. Besökare kan bidra med info via formulär. All data i JSON-filer i repot.

**Stack:** React 18, TypeScript, Vite, D3.js (SVG), Tailwind CSS, React Router, Vercel (hosting + serverless)

## Projektstruktur
```
public/data/          # persons.json, relationships.json (runtime fetch)
public/photos/        # Bilder på familjemedlemmar
src/
  components/
    Tree/             # TreeView (D3 pan/zoom), TreeLayout, Minimap
    PersonCard/       # PersonCardMini (SVG), PersonModal (centrerad modal med visning/redigering)
    AddForm/          # AddRelativeModal (modal med relationstypväljare + formulär)
    Modal/            # Återanvändbar Modal-komponent
    Search/           # SearchView med live-filtrering
    Gallery/          # GalleryView med familjesida-filter
    Layout/           # Header med navigation
  contexts/           # FamilyDataContext (data-fetching)
  hooks/              # useSearch
  utils/              # buildTree, formatPerson
  types/              # Person, Relationship, TreeNode
api/                  # Vercel serverless functions
  submit-contribution.ts  # GitHub Issue-flöde (med godkännande)
  submit-direct.ts        # Direkt commit till repo (utan godkännande)
docs/                 # Detaljerad dokumentation
```

## Kommandon
```bash
npm run dev           # Dev server (Vite)
npm run build         # Production build (tsc + vite build)
npx vitest run        # Kör alla tester
vercel --prod         # Deploya till Vercel
```

## Kodstil
- TypeScript strict, undvik `any`
- Svenska i all UI-text, engelska i kod (variabelnamn, funktioner)
- Tailwind CSS för styling, tema-variabler definierade i index.css (@theme)
- Komponenter som named exports, en komponent per fil
- Tester bredvid källfilen (`Foo.tsx` → `Foo.test.tsx`)
- Små commits med konventionell commit-format

## Designtema: "Naturnära arv"
- Bakgrund: `#f7f4ef` → `#eee8dc`
- Accent: `#6b8f71` (grön)
- Typsnitt: Lora (serif, rubriker), Inter (sans-serif, brödtext)
- Foton: Rundade rektanglar med grön ram

## Arbetsflöde
- Planera innan implementering: `/plan`
- Små diffar, kör tester efter varje ändring
- Konventionella commits: `feat(tree): description`
- Grena vid större arbete: `feat/short-slug`

## Konfiguration
- `REQUIRE_APPROVAL` i `src/App.tsx` — `true` för GitHub Issue-flöde, `false` för direkt-inmatning
- Vercel env vars: `GITHUB_TOKEN`, `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME`

## Referensdokumentation
- Arkitektur: @docs/architecture.md
- Datamodell & relationer: @docs/data-model.md
- Trädvy & layout: @docs/tree-system.md
- Konventioner: @docs/conventions.md
