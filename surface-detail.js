"use strict";
/* Local CC0 material library. Decoration only: never owns player state or collisions. */
(() => {
  function create(THREE, renderer) {
    const cache = new Map(), sources = new Map(), textures = new Set(), batches = [];
    const clock = {value: 0};
    let disposed = false;
    const status = {loaded: 0, failed: 0};
    const loader = new THREE.TextureLoader();
    function maps(kind, repeat) {
      const key = `${kind}:${repeat.join(",")}`;
      if (!sources.has(kind)) sources.set(kind, Promise.all(
        ["color", "normal", "roughness"].map(channel => new Promise((resolve, reject) => {
          const map = loader.load(`./assets/materials/${kind}-${channel}.jpg`, () => {
            if (disposed) { map.dispose(); resolve(null); return; }
            map.wrapS = map.wrapT = THREE.RepeatWrapping;
            map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
            map.colorSpace = channel === "color" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
            resolve(map);
          }, undefined, reject);
          textures.add(map);
        }))
      ).catch(() => { status.failed++; return null; }));
      if (!cache.has(key)) cache.set(key, sources.get(kind).then(result => {
        if (disposed || !result || result.some(map => !map)) return null;
        return result.map(original => {
          // Clones share the decoded image/Source and GPU upload, while each
          // surface keeps its own tiling transform. Only 12 image requests.
          const map = original.clone();
          map.repeat.set(...repeat); map.needsUpdate = true;
          textures.add(map); return map;
        });
      }));
      return cache.get(key);
    }
    function apply(material, kind, repeat = [1, 1], tint = null, strength = .5) {
      // Leave the existing material intact unless every map has loaded.
      return maps(kind, repeat).then(result => {
        if (disposed || !result || result.some(map => !map)) return false;
        [material.map, material.normalMap, material.roughnessMap] = result;
        material.normalScale.set(strength, strength);
        if (tint !== null) material.color.set(tint);
        material.roughness = 1;
        material.needsUpdate = true;
        status.loaded++;
        return true;
      });
    }
    function projectUV(geometry, scale = 1) {
      // Original glTF meshes and canyon cliffs have no UVs. Dominant-axis
      // projection gives their individual flat faces consistent material scale.
      if (geometry.getAttribute("uv")) return;
      const p = geometry.getAttribute("position"), n = geometry.getAttribute("normal");
      if (!p || !n) return;
      const uv = new Float32Array(p.count * 2);
      for (let i = 0; i < p.count; i++) {
        const x = Math.abs(n.getX(i)), y = Math.abs(n.getY(i)), z = Math.abs(n.getZ(i));
        uv[i * 2] = (x > y && x > z ? p.getZ(i) : p.getX(i)) * scale;
        uv[i * 2 + 1] = (y >= x && y >= z ? p.getZ(i) : p.getY(i)) * scale;
      }
      geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    }
    function village(root) {
      const handled = new Set();
      root.traverse(node => {
        if (!node.isMesh) return;
        projectUV(node.geometry, .7);
        for (const m of Array.isArray(node.material) ? node.material : [node.material]) {
          if (!m || handled.has(m)) continue;
          handled.add(m);
          if (/timber|wood/i.test(m.name)) apply(m, "wood", [1, 1], 0xd3b48d, .45);
          else if (/foundation|stone|masonry/i.test(m.name)) apply(m, "rock", [1, 1], 0xcec6b1, .6);
        }
      });
    }
    function meadow(scene, {height, allowed, count = 4200, desert = false}) {
      let seed = desert ? 8267 : 61271;
      const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
      const vertices = [], colors = [], indices = [];
      const bottom = new THREE.Color(desert ? 0x60563b : 0x315a31);
      const top = new THREE.Color(desert ? 0xc1b578 : 0xb4c874);
      // Three curved, tapered blades per tuft, one instanced draw for the field.
      for (let blade = 0; blade < 3; blade++) {
        const a = blade * Math.PI * 2 / 3, base = vertices.length / 3;
        for (const [w, y, bend] of [[-.034, 0, 0], [.034, 0, 0], [-.024, .21, .03], [.024, .21, .03], [0, .43, .12]]) {
          vertices.push(Math.cos(a) * w + Math.sin(a) * bend, y, Math.sin(a) * w + Math.cos(a) * bend);
          const c = bottom.clone().lerp(top, y / .43);
          colors.push(c.r, c.g, c.b);
        }
        indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2, base + 2, base + 3, base + 4);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      g.setIndex(indices); g.computeVertexNormals();
      const m = new THREE.MeshStandardMaterial({vertexColors: true, side: THREE.DoubleSide, roughness: 1});
      m.onBeforeCompile = shader => {
        shader.uniforms.trailWindTime = clock;
        shader.vertexShader = "uniform float trailWindTime;\n" + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `
          #include <begin_vertex>
          float phase = instanceMatrix[3].x * 0.8 + instanceMatrix[3].z * 0.5;
          transformed.x += sin(trailWindTime * 1.3 + phase) * position.y * position.y * 0.32;
          transformed.z += cos(trailWindTime + phase) * position.y * position.y * 0.18;
        `);
      };
      m.customProgramCacheKey = () => "trail-meadow-v1";
      const field = new THREE.InstancedMesh(g, m, count), dummy = new THREE.Object3D();
      field.name = desert ? "CC0 pass: canyon grasses" : "CC0 pass: meadow grasses";
      let placed = 0;
      for (let attempt = 0; attempt < count * 12 && placed < count; attempt++) {
        const x = (rand() - .5) * 44, z = (rand() - .5) * (desert ? 31 : 27);
        if (!allowed(x, z)) continue;
        const patch = Math.sin(x * 1.7 + z * .3) * Math.cos(z * 1.3);
        if (patch < -.1) continue;
        dummy.position.set(x, height(x, z), z);
        dummy.rotation.set(0, rand() * Math.PI * 2, 0);
        const scale = .45 + rand() * .85;
        dummy.scale.set(scale, scale * (desert ? .72 : 1), scale);
        dummy.updateMatrix(); field.setMatrixAt(placed++, dummy.matrix);
      }
      field.count = placed; field.instanceMatrix.needsUpdate = true;
      field.receiveShadow = true; field.computeBoundingSphere(); scene.add(field);
      batches.push({field, total: placed});
      return field;
    }
    function quality(preset, effects = true) {
      const fraction = {low: .12, medium: .45, high: .8, ultra: 1}[preset] ?? .8;
      for (const {field, total} of batches) field.count = Math.floor(total * fraction);
      if (!effects) clock.value = 0;
    }
    return {
      apply, projectUV, village, meadow, quality,
      update(time, animate = true) { clock.value = animate && Number.isFinite(time) ? time : 0; },
      status: () => ({...status}),
      dispose() {
        disposed = true;
        for (const t of textures) t.dispose();
        for (const {field} of batches) { field.removeFromParent(); field.geometry.dispose(); field.material.dispose(); }
        cache.clear(); sources.clear(); textures.clear(); batches.length = 0;
      }
    };
  }
  window.ThirstSurfaces = Object.freeze({create});
})();
