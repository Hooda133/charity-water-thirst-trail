# Shared adventure character — October 25 upgrade

Both chapters now use the original local procedural model in `../../explorer.js`. It builds immediately from the already-loaded Three.js API and needs no character download. The older glTF below is retained only as a compatibility fallback if the shared module is unavailable.

The active character has dark brown skin, sculpted facial features and ears, cropped curls, a fitted teal overshirt, stitched pockets, rolled cuffs, articulated hands with fingers and thumbs, tailored trousers, and laced boots. His only carried equipment is a broad yellow water can on his back, with beveled corners, an open carrying handle, a screw cap and molded X ribs, supported by two continuous shoulder straps and buckles. There is no hat, scarf, compass, flask, bedroll or extra pack.

The 106-mesh, 28,384-triangle character uses smooth standard PBR materials with different fabric, skin, rubber and plastic roughness. It shares geometry and materials internally, uses the existing chapter lighting, and adds no textures or postprocessing. Valley's existing character fill is warm neutral.

Animation is shared: distance-driven walking/running (running where gameplay supports it), two-link leg solving with a grounded stance foot, counter-swinging arms, idle breathing, blinking, interaction reach and a blended two-arm victory pose. The rigid jug has restrained secondary movement. Turning keeps each chapter's existing smooth heading interpolation. Canyon keeps rendering its victory pose after gameplay ends. Reduced-motion settings suppress secondary motion.

Camera-to-head and camera-to-torso raycasts run at approximately 15 Hz. Scenery blocking either ray fades smoothly; original material objects are restored afterward. Shared scenery materials are cloned only for affected objects. Quest nameplates draw above scenery without writing depth. None of these changes alter collisions, controls, quest state, saved data, audio or camera navigation.

Run `node tools/test-explorer-motion.mjs` to fetch the pinned MIT Three.js module and test the real transforms and raycasting; supply a local Three.js module path as the first argument for offline use.

---

## Retained legacy asset documentation

# The Playable Explorer — 3D Character Asset

**Asset:** [explorer.gltf](explorer.gltf) • Original glTF 2.0 model with an embedded geometry buffer.

The new explorer features a padded teal adventurer jacket, expressive face and eyes, ranger hat, shoulder scarf, travel pack and bedroll, brass compass, hanging flask, articulated gloves, pants and boots. The mesh is approximately **5,928 triangles**, with **14 named rig nodes** and 28 colored PBR materials.

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
