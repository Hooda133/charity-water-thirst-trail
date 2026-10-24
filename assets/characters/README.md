# The Playable Explorer — 3D Character Asset

**Asset:** [explorer.gltf](explorer.gltf) • Original glTF 2.0 model with an embedded geometry buffer.

The new explorer features a padded teal adventurer jacket, expressive face and eyes, ranger hat, shoulder scarf, travel pack and bedroll, brass compass, hanging flask, articulated gloves, pants and boots. The mesh is approximately **5,928 triangles**, with **14 named rig nodes** and 28 colored PBR materials.

## Clean-water yellow visual identity — October 24

The explorer jacket and existing backpack have been recolored in a warm yellow and dark-strap palette inspired by clean-water adventure storytelling. The flask uses blue water-inspired tones. This is a visual recolor of the existing mesh, not a new reservoir mechanic or a partnership/official charity: water character. The named rig nodes and animations remain unchanged.

## Visual refinement — October 21

Following a real in-game screenshot, the explorer received warmer skin and clothing colors, a slightly larger readable face, slimmer padded sleeves and legs, a less bulky pack, and interpolated vertex normals across rounded surfaces. The gait now eases into and out of motion instead of stopping abruptly. The original camera and movement speed were not changed.

## Animation rig

The model uses named transform pivots instead of hard-coded positions baked into the scene. `script.js` animates:

- `ExplorerBody` — idle breathing, walking bounce and turning lean.
- `ExplorerHead` and `ExplorerEyes` — gentle looking motion, smile and periodic blinking.
- `ExplorerArmLeft`, `ExplorerArmRight`, `ExplorerElbowLeft`, `ExplorerElbowRight` — natural arm swing, NPC greeting and hands-up victory poses.
- `ExplorerLegLeft`, `ExplorerLegRight`, `ExplorerKneeLeft`, `ExplorerKneeRight` — walking with articulated knees.
- `ExplorerScarfTail` — fluttering with movement.
- `ExplorerPackFlap` — moving with footsteps.

The source asset intentionally contains rig pivots rather than a large animation-library payload. The runtime builds smooth blended poses from the rig: idle breathing, walk/run stride, interaction greeting, celebration, turning lean, blinking, scarf movement and pack motion. Blend weights are frame-time based, so transitions do not snap when movement starts or stops. Materials are promoted to smooth PBR shading at load time, with tuned roughness for skin, hair, fabric, leather and metal equipment, and a small character fill light keeps the explorer readable in both daylight and night scenes.

All animations are driven by the **same game movement and mission state as the original character**, including the reduced-motion setting.

## Loading and safe fallback

The game loads `assets/characters/explorer.gltf` using its pinned GLTFLoader. It retains the former procedural character until the original model and every required named joint have been validated. If any part is missing, the loader is blocked, or the file is unavailable, the existing character remains playable.

The game provides `getCharacterAssetStatus()` for debugging (`ready`, `loading`, `fallback`).

## Validation

In Codespaces, run:

```bash
node tools/validate-explorer.mjs
```

With DevTools Console open, reload the preview and look for:

```text
Thirst Trail: loaded original animated explorer model.
```

Then test normal walking, greeting an NPC, quest completion and the winning pose. **Zoom the camera in to inspect facial details** — the default camera zoom is intentionally unchanged.

Model validation and simulated rig-animation tests do not verify the actual final WebGL appearance, framing, shader quality or GPU frame rate. Check those in the real browser.

See [ASSET_LICENSE.md](ASSET_LICENSE.md) for provenance.
