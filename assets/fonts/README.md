# Thirst Trail typography

The interface uses **Nunito Sans**, a clean geometric/humanist sans serif chosen to evoke charity: water's Proxima Nova and Avenir typography. This is an open-source alternative, not the charity's official font. The reference is the [charity: water Brand Book, page 19](https://d11sa1anfvm2xk.cloudfront.net/media/downloads/brandbook-2016.pdf#page=19), linked from its official media resources page.

Use the shared `--font-ui` stack for headings, body copy, buttons, forms, puzzles, chapter menus, resource counters, footer links, and canvas text. Bold headings and semibold controls establish hierarchy; paragraph text keeps comfortable line spacing. The Avenir/Helvetica/Arial fallback stack remains readable while the font loads or if it is unavailable. There is no third-party font request at runtime.

## Font asset and license

- Family/version: Nunito Sans 3.101, normal variable face.
- Source: [Google Fonts source font](https://github.com/google/fonts/blob/main/ofl/nunitosans/NunitoSans%5BYTLC%2Copsz%2Cwdth%2Cwght%5D.ttf), downloaded October 28, 2026.
- Copyright 2016 The Nunito Sans Project Authors. Distributed under the [SIL Open Font License 1.1](OFL.txt); retained in full beside the font.
- Web build: WOFF2, weights 400–900; normal width and default lowercase height. The optical-size axis is retained. The subset includes Latin text, accents, punctuation, and supported arrows/symbols; system fonts supply missing symbols and emoji.
- Build tools: FontTools `instantiateVariableFont` (weight 400–900, width 100, YTLC 500), then the FontTools subsetter and WOFF2 compression. Unicode ranges: U+0000–024F, U+02B0–036F, U+1E00–1EFF, U+2000–22FF, U+FEFF, U+FFFD; all layout features retained.

`index.html` preloads the same local file used by `@font-face`; `font-display: swap` keeps text visible. `typography.js` shares the CSS stack with canvas renderers and exposes font readiness for their one-time 3D nameplate textures.
