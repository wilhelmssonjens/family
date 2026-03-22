# Arkitektur

## Översikt

React SPA som renderar ett interaktivt horisontellt släktträd med D3.js. Data lagras som statiska JSON-filer i `public/data/` och hämtas via `fetch()` vid runtime. Bidrag hanteras via Vercel serverless functions som antingen skapar GitHub Issues (med godkännande) eller committar direkt till repot.

## Dataflöde

```
public/data/*.json ──fetch()──> FamilyDataContext ──> TreeView/SearchView/GalleryView
                                                           │
                                                      PersonCardMini (SVG)
                                                           │ (klick)
                                                      PersonModal (centrerad modal)
                                                      ├── Visa alla detaljer
                                                      ├── Redigera inline → api/submit-direct.ts
                                                      └── Lägg till släkting → AddRelativeModal
                                                           │ (skicka)
                                             api/submit-direct.ts ──GitHub API──> public/data/*.json
                                             api/submit-contribution.ts ──GitHub API──> GitHub Issue
```

## Hosting & Deploy
- **Vercel** med automatisk deploy vid push till `main`
- Serverless functions i `api/`-mappen (Vercel Node.js runtime)
- SPA-routing via `vercel.json` rewrites

## Säkerhet
- GitHub-token som Vercel environment variable
- IP-baserad rate limiting (10 req/timme)
- Honeypot-fält i formulär mot botar
- Foto-upload stöds ej i v1

## Nyckeltekniker
| Teknik | Användning |
|--------|-----------|
| D3.js + d3-zoom | SVG-rendering av träd med pan/zoom |
| React Context | FamilyDataContext för global data |
| React Router | SPA-routing (`/`, `/sok`, `/galleri`, `/person/:id`) |
| Modal-system | Centrerade modaler för persondetaljer, redigering och lägg-till-släkting |
| Vercel Functions | Serverless endpoints för bidrag |
