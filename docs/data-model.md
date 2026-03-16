# Datamodell & Relationer

## Filer
- `public/data/persons.json` — Array med Person-objekt
- `public/data/relationships.json` — Array med Relationship-objekt
- `public/photos/` — Bilder, refererade i Person.photos

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
  photos: string[]         // Sökvägar relativt public/ ("photos/jens-1.jpg")
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

## Hur man lägger till en person

1. Lägg till Person-objekt i `public/data/persons.json`
2. Lägg till Relationship-objekt i `public/data/relationships.json`
3. Sätt `familySide` korrekt (`jens` för Jens släkt, `klara` för Klaras)
4. Deploya (push till main → Vercel auto-deploy)
