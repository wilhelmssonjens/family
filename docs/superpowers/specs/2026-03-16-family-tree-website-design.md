# Släkthemsida — Designspecifikation

## Översikt

En publik släkthemsida centrerad kring Jens och Klara. Besökare kan utforska båda familjernas släktträd via en interaktiv horisontell trädvy med pan/zoom, klicka på personer för att se detaljer, och bidra med ny information via inline-formulär som skapar GitHub Issues.

**Språk:** Helt på svenska (all UI-text).
**Tillgänglighet:** Helt publik, ingen autentisering.
**Hosting:** Vercel.

---

## Datamodell

All data lagras i JSON-filer i repot.

### `data/persons.json`

Array med personobjekt:

```json
{
  "id": "jens",
  "firstName": "Jens",
  "lastName": "Andersson",
  "birthName": null,
  "birthDate": "1995-03-12",
  "birthPlace": "Göteborg",
  "deathDate": null,
  "deathPlace": null,
  "gender": "male",
  "occupation": "Ingenjör",
  "photos": ["photos/jens-1.jpg"],
  "stories": [
    { "title": "Somrarna i stugan", "text": "Varje sommar..." }
  ],
  "contactInfo": null,
  "familySide": "center"
}
```

Fält per person:
- `id` — Unik identifierare (slug)
- `firstName`, `lastName` — Namn
- `birthName` — Födnamn (om annat än nuvarande)
- `birthDate`, `birthPlace` — Födelse
- `deathDate`, `deathPlace` — Död (null om levande)
- `gender` — "male", "female", eller "other"
- `occupation` — Yrke/sysselsättning
- `photos` — Array med sökvägar relativt till `public/`
- `stories` — Array med `{ title, text }`-objekt
- `contactInfo` — Fritext, valfritt
- `familySide` — `"jens"`, `"klara"`, eller `"center"`

### `data/relationships.json`

Array med relationsobjekt:

```json
{ "type": "partner", "from": "jens", "to": "klara" },
{ "type": "parent", "from": "erik", "to": "jens" }
```

Relationstyper:
- `partner` — Gift/sambo (symmetrisk). Flera `partner`-relationer tillåts per person (omgifte). Valfritt fält `status`: `"current"` eller `"former"`.
- `parent` — `from` är förälder till `to` (riktad)

Härledda relationer:
- **Syskon** härleds automatiskt — två personer som delar minst en förälder. Halvsyskon (delar en förälder) stöds implicit.
- Steg-/adoptivrelationer ligger utanför v1-scopet.

### Foton

Lagras i `public/photos/` i repot.

---

## Trädvisning

### Bibliotek

D3.js med SVG för full kontroll över den horisontella layouten. d3-zoom för pan/zoom.

### Layout

- Jens & Klara renderas som ett par i mitten
- Jens föräldrar expanderar åt vänster, deras föräldrar ännu längre vänster
- Klaras föräldrar expanderar åt höger
- Eventuella barn till Jens & Klara renderas vertikalt under paret i mitten
- Syskon renderas vertikalt (ovanför/under) på samma horisontella nivå
- Linjer mellan föräldrar–barn och partner-par
- `familySide` styr vilken sida personen hamnar på
- Dynamisk spacing — noder anpassar avstånd baserat på antal syskon/barn för att undvika överlapp
- V1 riktar sig mot upp till 500 personer. Vid väsentligt större dataset kan canvas-rendering eller virtualisering behövas.

### Minimap

En nedskalad silhuett av hela trädet visas i nedre högra hörnet. En rektangel markerar det synliga området (viewport). Klick/drag i minimap:en panorerar huvudvyn.

### Interaktion

- **Pan:** Klicka och dra
- **Zoom:** Scrollhjul eller pinch-to-zoom
- **Klick på person:** Kortet expanderar inline med full info
- **Klick utanför:** Kortet fälls ihop
- **"+"-knappar:** Syns vid varje person för att lägga till förälder, syskon, eller partner
- **Minimap:** Liten översiktskarta i ett hörn för orientering i stora träd

### Responsivitet

- Desktop: Full pan/zoom med mus
- Mobil: Touch-gester, anpassade kort för mindre skärm
- Startvy: Centrerad på Jens & Klara, zoomad så föräldragenerationen syns

---

## Personkort

### Minimerat kort (i trädvyn)

- Cirkulärt foto (eller initialer om foto saknas)
- Förnamn
- Födelseår (–dödsår)
- Grön/jordnära ram

### Expanderat kort (vid klick)

Kortet växer ut med mjuk animation och visar:

1. **Foto** — Större, bläddring om flera foton
2. **Fullständigt namn** — Inklusive födnamn
3. **Livstid** — "f. 1952 i Göteborg" / "f. 1952 – d. 2020 i Stockholm"
4. **Yrke**
5. **Berättelser/anekdoter** — Expanderbara sektioner
6. **Relation** — "Far till Jens", "Gift med Anna"
7. **Redigera-knapp** — Öppnar inline-formulär, skapar GitHub Issue

### "+"-knappar

Diskreta cirklar med "+" vid kanten av varje persons kort:
- Horisontellt (vänster/höger): Lägg till förälder
- Vertikalt (ovan/under): Lägg till syskon
- Bredvid: Lägg till partner

### Inline-formulär

- **Fas 1 (kompakt):** Förnamn, efternamn, relationstyp — tre fält + spara-knapp
- **Fas 2 (utfällt, valfritt):** Alla övriga fält — datum, plats, yrke, foto-upload, berättelse
- Spara → skapar GitHub Issue med all ifylld data

---

## Sidor och navigation

### Routing (React Router)

| Route | Vy |
|-------|----|
| `/` | Trädvyn (startsida) |
| `/sok` | Sökvy |
| `/galleri` | Bildgalleri |
| `/person/:id` | Trädvyn centrerad på specifik person (deep-link) |

### Tre vyer

1. **Trädvyn** (startsida, `/`) — Interaktivt horisontellt släktträd
2. **Sök** (`/sok`) — Enstaka sökfält, substring-matchning (case-insensitive) på förnamn, efternamn, födelseort, yrke. Resultat som scrollbar lista med korta personkort. Klick navigerar till `/person/:id` och centrerar trädet.
3. **Bildgalleri** (`/galleri`) — Alla foton, filtrerbara per person eller familjesida (Jens/Klara). Klick navigerar till personen i trädet.

### Header/navigation

- Sidans namn (t.ex. "Familjen Andersson & Lindqvist")
- Tre nav-ikoner: Träd | Sök | Galleri
- Diskret, ska inte ta uppmärksamhet från innehållet
- Naturnära stil

---

## Designstil: Naturnära arv

- **Bakgrund:** Varm off-white, gradient (`#f7f4ef` → `#eee8dc`)
- **Accenter:** Grönt (`#6b8f71`) — knappar, ramar, aktiva element
- **Text:** Mörk (`#3a3a3a`)
- **Sekundärtext:** Dämpad (`#777`)
- **Kort-bakgrund:** Vit med grön vänsterborder, subtil skugga
- **Typsnitt rubriker/namn:** Serif (t.ex. Lora)
- **Typsnitt brödtext:** Sans-serif (t.ex. Inter)
- **Foton:** Rundade rektanglar med grön ram
- **Känsla:** Lugnt, jordnära, som rötter och löv

---

## GitHub Issues-flöde

### Bidrag från besökare

1. Besökare klickar "+" eller "Redigera" i trädet
2. Fyller i inline-formuläret
3. Klickar "Skicka"
4. Vercel serverless function skapar GitHub Issue via GitHub API:
   - Label: `bidrag`
   - Titel: "Ny person: Erik Andersson" eller "Uppdatera: Anna Svensson"
   - Body: Strukturerad JSON-data + eventuell fritext
5. Jens granskar issue:n på GitHub
6. Framtida automation: GitHub Action som parsear godkända issues och auto-committar ändringarna i JSON-filerna

### Foto-upload

Foto-upload stöds inte i v1 av besökarformuläret (GitHub Issues har begränsad stöd för binärdata). Besökare kan istället beskriva vilka foton de har i fritextfältet, och Jens lägger till foton manuellt vid godkännande.

### Säkerhet och missbruksskydd

- GitHub-token lagras som Vercel environment variable, aldrig i repot
- API-endpointen har IP-baserad rate limiting (max 10 requests/timme per IP)
- Honeypot-fält i formuläret för att filtrera bort botar

---

## Import av data

- **JSON direkt** — Redigera `data/persons.json` och `data/relationships.json`
- **Papperskällor** — Fota/scanna, ge till Claude för avläsning → JSON
- **GEDCOM-import** — Importscript som konverterar GEDCOM → projektets JSON-format
- **CSV/Excel** — Importscript för tabulär data

---

## Dataladdning

JSON-filerna (`persons.json`, `relationships.json`) lagras i `public/data/` och hämtas via `fetch()` vid runtime. Detta innebär att en ny deploy (auto-trigger via Vercel vid push) krävs för att uppdaterad data ska synas, men ingen rebuild behövs — filerna serveras statiskt.

---

## State management

React Context för global state:
- `TreeContext` — persondata, relationer, vilken person som är expanderad, pan/zoom-transform
- `UIContext` — aktiv vy, formulärtillstånd

Inget externt state-bibliotek behövs i v1.

---

## Felhantering och laddningstillstånd

- **Laddning:** Spinner vid initial datahämtning
- **Datahämtningsfel:** Felmeddelande med "Försök igen"-knapp
- **Formulär:** Tydlig bekräftelse ("Tack! Ditt bidrag har skickats.") eller felmeddelande vid nätverksfel
- **Tom data:** Tomt träd med uppmaning att börja lägga till personer

---

## Teknikstack

| Vad | Val |
|-----|-----|
| Ramverk | React 18 + TypeScript + React Router |
| Byggverktyg | Vite |
| Trädrendering | D3.js (SVG) |
| Pan/zoom | d3-zoom |
| Styling | Tailwind CSS med naturnära tema |
| Typsnitt | Lora (serif, rubriker) + Inter (sans-serif, brödtext) |
| Serverless | Vercel serverless functions (1 endpoint) |
| Hosting | Vercel |
| Data | JSON-filer i repot |
| Bilder | `public/photos/` |
| CI/CD | GitHub Actions + Vercel auto-deploy |
| Sök | Klientside filtrering av JSON |

---

## Mapstruktur

```
family/
├── public/
│   ├── data/
│   │   ├── persons.json
│   │   └── relationships.json
│   └── photos/
├── src/
│   ├── components/
│   │   ├── Tree/          # Trädvy med D3
│   │   ├── PersonCard/    # Minimerat + expanderat kort
│   │   ├── AddForm/       # Inline-formulär (kompakt + utfällt)
│   │   ├── Search/        # Sökvy
│   │   ├── Gallery/       # Bildgalleri
│   │   └── Layout/        # Header, navigation
│   ├── contexts/          # TreeContext, UIContext
│   ├── data/
│   │   └── types.ts       # TypeScript-typer för Person, Relationship
│   ├── hooks/             # useTree, usePanZoom, useSearch
│   ├── utils/             # Trädberäkningar, GEDCOM-import
│   ├── App.tsx
│   └── main.tsx
├── api/
│   └── submit-contribution.ts  # Vercel serverless function
└── scripts/
    └── import-gedcom.ts   # CLI-importverktyg (GEDCOM 5.5.1, CSV)
```
