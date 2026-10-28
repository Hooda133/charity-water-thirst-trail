# Curated Thirst Trail assets

`tools/import_cc0_assets.py` downloads curated Kenney CC0 GLBs and small ambientCG CC0 PBR texture sets here. It optionally imports verified-CC0 Poly Pizza models with an API key and explicitly pinned official Quaternius/Fab downloads from `tools/asset_sources.json`.

Each imported file is recorded in `manifest.json` with origin URL, license, creator when required, SHA-256 and byte size. Quaternius/Fab entries must provide a publicly available direct HTTPS file URL, an independently verified CC license, and SHA-256; the importer does not scrape or bypass marketplace access.

Imported files are **not automatically loaded by the game**. Integrate selectively into Three.js after reviewing artistic consistency, asset scale, model texture dependencies, mobile performance, and credits. Never replace `assets/characters/explorer.gltf` blindly or remove its yellow-jug character design. Existing game scenes and gameplay are unchanged by this importer.

Free does not mean public domain: Fab Standard/other marketplace licenses are not auto-importable into a public GitHub repo. Poly Pizza has per-model CC0/CC-BY licensing; the optional API adapter accepts only CC0 records. Kenney and Quaternius CC0 source URLs: https://kenney.nl/support and https://quaternius.com/faq.html.
