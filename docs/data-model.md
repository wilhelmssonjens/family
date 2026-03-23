# Datamodell & Relationer

## Filer
- `public/data/persons.json` — Array med Person-objekt
- `public/data/relationships.json` — Array med Relationship-objekt
- Foton lagras i **Vercel Blob** (publika URL:er i Person.photos)

## Person

```typescript
interface Person {
  id: string              // Unik slug (t.ex. "jens", "erik-andersson")
  firstName: string
  lastName: string
  birthName: string | null // Födnamn om ändrat
  birthDate: string | null // "ÅÅÅÅ-MM-DD"
  birthPlace: string | null
  deathDate: string | null
  deathPlace: string | null
  gender: 'male' | 'female' | 'other'
  occupation: string | null
  photos: string[]         // Vercel Blob URL:er eller lokala sökvägar
  stories: Story[]
  contactInfo: string | null
  familySide: 'jens' | 'klara' | 'center' // Styr placering i trädet
}
```

## Relationship

```typescript
interface Relationship {
  type: 'partner' | 'parent'
  from: string  // Person-ID
  to: string    // Person-ID
  status?: 'current' | 'former' // Bara för partner (omgifte)
}
```

- `partner`: Symmetrisk (gift/sambo). Flera tillåts per person.
- `parent`: Riktad — `from` är förälder till `to`.
- **Syskon** härleds automatiskt (delar minst en förälder).

## FamilyGraph (runtime)

`buildFamilyGraph()` i `src/utils/buildTree.ts` skapar en `Map<string, FamilyNode>` med:
- `parentIds`, `childIds`, `partnerIds` — för snabb lookup i alla riktningar
- Används av `getParents()`, `getChildren()`, `getSiblings()`, `getPartners()`

## API-operationer (submit-direct.ts)

| `relationType` | Vad händer |
|----------------|------------|
| `parent`/`child`/`sibling`/`partner` | Skapar ny person + relation |
| `edit` | Uppdaterar befintlig person |
| `delete` | Tar bort person + alla dess relationer |
| `link` | Skapar bara en relation mellan två befintliga personer |

Alla operationer committar direkt till GitHub via API:et. Duplikatskydd via `addRelationIfNew()`.

## Hur man lägger till en person

**Via UI:t** (rekommenderat): Klicka på en person → "Lägg till släkting" → välj relationstyp → fyll i formulär eller sök befintlig person.

**Manuellt:**
1. Lägg till Person-objekt i `public/data/persons.json`
2. Lägg till Relationship-objekt i `public/data/relationships.json`
3. Sätt `familySide` korrekt (`jens` för Jens släkt, `klara` för Klaras, `center` för centerparet)
4. Deploya (push till main → Vercel auto-deploy)
