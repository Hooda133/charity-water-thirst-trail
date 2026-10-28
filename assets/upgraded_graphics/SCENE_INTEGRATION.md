# CC0 3D models in Thirst Trail's four worlds

The integration in `scenic-assets.js` adds small curated low-poly GLB props and modular models from **Kenney** and **Quaternius** alongside the original procedural world art.

| World | Examples | Location |
| --- | --- | --- |
| Greenwater Valley | Oak trees, Quaternius trees, small cottages, flowers and stone | Near village edge, gardens and hillside |
| Forgotten Canyon | Cacti, sandstone rocks, supply barrels, decorative timber | Outside the trail corridor and puzzle controls |
| Stormbreak Coast | Detailed palms, rowboat, harbor dock kit, barrels, fences | Beach and harbor |
| Village Life | Cottages, shrubs, garden planters, saplings, fences | Within the existing restored valley, visible in Village Life |

**How to view:** Launch the web game normally with a working 3D renderer. Choose **High** or **Ultra** under Settings to display all additions. Low/Medium display fewer models to help mobile GPUs. Asset loading is asynchronous and does not delay character movement.

**Model ownership:** GLB sources are pinned to immutable GitHub commits from publicly redistributed CC0 packs. The Python asset importer (`tools/import_cc0_assets.py`) generates `assets/upgraded_graphics/manifest.json` with original creator, license, source URL, SHA-256 and file size. The runtime first loads from the local `assets/upgraded_graphics/` path; a pinned public mirror is used only if the local files are not yet vendored. The base game does not depend on either source for its core gameplay.

**Safety:** These are decorative scene objects, *not* player collision objects, pickup targets, or puzzle controls. The character (including the yellow jug), paths, saves, accessibility labels and 2D fallback are unchanged. A failed optional download leaves the existing 3D world in place.

**Integration notes:** For all four areas, the shared loader clones and normalizes each GLB to a measured real-world scale, retains authored embedded materials and textures, uses a quality-tier loading budget, marks meshes as non-camera-occluders, and cleans up GPU resources when the associated chapter scene is disposed. To inspect live status in a browser console, run `TrailScenicAssets.status()`.

**Performance/validation:** `node tools/test-scenic-assets.mjs` checks placements, selected licensed-model names, quality tiers, module loading order and disposal wiring. GitHub Actions also runs the existing chapter/character/puzzle tests and a browser playthrough. Imported models have not been validated on every GPU or device; browser preview and visual positioning should be reviewed prior to merging.
