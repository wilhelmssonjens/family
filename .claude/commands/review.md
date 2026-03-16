---
description: Kodgranskning med fokus på korrekthet och projektkonventioner
---

Granska: $ARGUMENTS

Fokusområden:
1. Logiska fel och edge cases
2. Säkerhetsproblem (injection, exponerade hemligheter)
3. TypeScript-fel och null-safety
4. Efterlevnad av projektkonventioner (se CLAUDE.md och @docs/conventions.md):
   - Strict TypeScript — inga `any`
   - Svenska UI-text, engelsk kod
   - Tailwind tema-variabler
   - Named exports
5. Testning — saknas tester för nya funktioner?
6. Prestanda — onödiga re-renders, tunga beräkningar utan memoization?

Peka på exakta filsökvägar och radnummer. Föreslå konkreta fixar.
