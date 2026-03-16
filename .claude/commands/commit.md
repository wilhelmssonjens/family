---
description: Skapa konventionellt commit-meddelande från stagade ändringar
---

Analysera stagade ändringar (`git diff --staged`) och skapa ett commit-meddelande.

Format: `<type>(<scope>): <beskrivning>`
Typer: feat, fix, refactor, docs, test, chore
Scopes: tree, card, search, gallery, form, api, data, layout, deps

Body (vid behov):
```
Varför:
  <varför denna ändring>

Hur:
  <nyckeldetaljer i implementeringen>
```

Lägg alltid till:
```
Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

Om ändringarna är för stora för en commit, föreslå hur de kan delas upp.
Committa inte — presentera meddelandet för godkännande först.
