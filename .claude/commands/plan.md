---
description: Planera nytt arbete — analysera, designa, bryt ner i steg
---

Planera följande arbete: $ARGUMENTS

## Fas 1: Förstå

1. Läs relevanta docs (`docs/`) för att förstå de system som berörs
2. Utforska kodbasen — läs nyckelfiler som påverkas, spåra dataflöden
3. Identifiera alla filer som behöver ändras

## Fas 2: Designa

Bryt ner arbetet i konkreta implementeringssteg. För varje steg:
- **Vad**: En tydlig ändring (t.ex. "Lägg till `birthName`-visning i PersonCardExpanded")
- **Var**: Vilka filer som påverkas
- **Klart när**: Observerbar verifiering (test passerar, typecheck OK, UI visar X)
- **Risker/frågor**: Oklarheter som behöver input

Håll stegen små — varje steg ska vara en commit-storlek.

## Fas 3: Presentera

Visa planen som en numrerad sammanfattning med:
- Beroendekedja (vad blockerar vad)
- Ungefärligt scope (antal filer, komplexitet)
- Öppna frågor eller beslut som behövs

Starta INTE implementering. Vänta på godkännande.
