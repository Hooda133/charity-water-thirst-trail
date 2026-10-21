# Thirst Trail — glTF Village Asset Pipeline

## What's included

- `village-kit.gltf`: Original glTF 2.0 scene, embedded binary buffer, four detailed village buildings
- Models/nodes: `ElderHall`, `UpperCottage`, `LowerCottage`, `Workshop`
- More than 10,000 triangles **across all four** models, with individually authored timber, roofing, windows, porches, plaster, masonry, workshop details, shutters, flowers, and eaves
- Separate glTF metallic/roughness materials; warm window emission for night scenes

Unlike the original procedural cottages, these are **loadable 3D model assets**, stored directly in the repository. No unrelated third-party assets were used.

## Runtime behavior

`index.html` pins `three` and `three/addons/` with an import map. The 3D game dynamically imports `GLTFLoader`, then fetches `assets/village/village-kit.gltf` relative to the page URL. All four houses start as the existing procedural fallback. When a real model is loaded and its node confirmed, the model swaps in at the **same position and scale**, and only then is its procedural counterpart hidden. If a CDN is blocked, the file cannot load, or one node is missing, the fallback stays visible and the quests continue unchanged.

The 2D fallback does not load 3D files. The older cottage geometry remains in `script.js` intentionally.

## Validate

From the Codespaces repository root:

```bash
node tools/validate-village.mjs
```

This verifies glTF JSON, accessors, byte alignment, embedded binary buffer size, mesh triangle indices, expected model names, material references, and the runtime import map.

Then open the preview through **Live Preview / a local HTTP server**. Do not use `file://` URLs; browsers generally block file-based model fetches.

Use browser DevTools Console to verify the message `Thirst Trail: loaded 4 original glTF village models.`. If a model fails, look for the warning `keeping procedural village` and check your network/CDN access.

## Updating models

A compatible modeling tool such as Blender can import glTF 2.0. Keep node names, model scale, the root at (0,0,0), and front doors facing +Z. Export as glTF 2.0 and adjust the asset loader path if changing the filename. Validate the result and test with the live game. Keep a safe fallback and license notes for any new external assets.

See `ASSET_LICENSE.md` for provenance and reuse conditions.
