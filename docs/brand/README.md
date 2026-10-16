# Mandate brand

The mark is two nested triangles: a boundary, and what it contains. The core is the only colour: an indigo-to-magenta gradient taken from the product itself (the primary action and the portal glow).

| File | Use |
| --- | --- |
| `mark-on-dark.*`, `mark-on-light.*` | the mark alone, transparent background |
| `lockup-on-dark.*`, `lockup-on-light.*` | mark + MANDATE wordmark, transparent background |
| `lockup-dark-background.png`, `lockup-light-background.png` | the lockup on a solid background, ready to use |
| `app-icon.svg`, `app-icon-512.png` | rounded-square icon (also the favicon) |

Colours: ink `#050609`, off-white `#f4f4f7`, core gradient `#7a66ff` to `#d56cff` (on dark) / `#5642d6` to `#bf4fe6` (on light), lavender accent `#b9a9ff`, action violet `#6550d9`. Amber appears only inside the hero artwork. The SVG lockups set the wordmark in a system sans stack; the PNGs are the authoritative lettering. Regenerate everything with `node web/scripts/make-logo.mjs`.
