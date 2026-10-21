# The Playable Explorer — 3D Character Asset

**Asset:** [explorer.gltf](explorer.gltf) • Original glTF 2.0 model with an embedded geometry buffer.

The new explorer features a padded teal adventurer jacket, expressive face and eyes, ranger hat, shoulder scarf, travel pack and bedroll, brass compass, hanging flask, articulated gloves, pants and boots. The mesh is approximately **5,928 triangles**, with **14 named rig nodes** and 28 colored PBR materials.

## Animation rig

The model uses named transform pivots instead of hard-coded positions baked into the scene. `script.js` animates:

- `ExplorerBody` — idle breathing, walking bounce and turning lean.
- `ExplorerHead` and `ExplorerEyes` — gentle looking motion, smile and periodic blinking.
- `ExplorerArmLeft`, `ExplorerArmRight`, `ExplorerElbowLeft`, `ExplorerElbowRight` — natural arm swing, NPC greeting and hands-up victory poses.
- `ExplorerLegLeft`, `ExplorerLegRight`, `ExplorerKneeLeft`, `ExplorerKneeRight` — walking with articulated knees.
- `ExplorerScarfTail` — fluttering with movement.
- `ExplorerPackFlap` — moving with footsteps.

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
