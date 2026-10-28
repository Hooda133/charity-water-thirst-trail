"use strict";
/* Original screen-space mission nameplates, shared by all 3D chapters. */
(() => {
  function create(THREE, {camera, canvas, labels}) {
    const layer = document.createElement("div");
    layer.className = "world-mission-labels";
    layer.setAttribute("aria-hidden", "true");
    layer.hidden = true;
    const point = new THREE.Vector3(), cameraPoint = new THREE.Vector3();
    let parent = null, dirty = true, width = 0, height = 0, visibleCount = 0;
    let offsetLeft = NaN, offsetTop = NaN;
    const entries = labels.map(label => {
      const element = document.createElement("span");
      element.className = "world-mission-label";
      element.dataset.mission = label.id;
      element.textContent = label.title;
      layer.append(element);
      return {...label, element, width: 0, height: 0};
    });
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(() => { dirty = true; }) : null;
    observer?.observe(canvas);
    Promise.resolve(window.TrailTypography?.ready).then(() => { dirty = true; });

    function update({visible = true, completed = [], activeKey = null} = {}) {
      visibleCount = 0;
      if (!visible || !canvas.isConnected || !canvas.clientWidth || !canvas.clientHeight) {
        layer.hidden = true;
        return;
      }
      if (parent !== canvas.parentElement) {
        parent = canvas.parentElement;
        parent.append(layer);
        offsetLeft = offsetTop = NaN;
        dirty = true;
      }
      layer.hidden = false;
      // The canvas can move within its parent when a sidebar or HUD expands,
      // without changing width/height. Track its actual position each update
      // so labels never drift away from their world-space mission markers.
      const view = canvas.getBoundingClientRect(), frame = parent.getBoundingClientRect();
      const left = view.left - frame.left - parent.clientLeft;
      const top = view.top - frame.top - parent.clientTop;
      if(left !== offsetLeft || top !== offsetTop){
        layer.style.left = `${left}px`;
        layer.style.top = `${top}px`;
        offsetLeft=left;offsetTop=top;
      }
      if (dirty || width !== canvas.clientWidth || height !== canvas.clientHeight) {
        width = canvas.clientWidth; height = canvas.clientHeight;
        layer.style.width = `${width}px`; layer.style.height = `${height}px`;
        for (const entry of entries) {
          entry.element.hidden = false;
          entry.element.style.maxWidth = `${Math.max(70, Math.min(240, width - 24))}px`;
          entry.width = entry.element.offsetWidth;
          entry.height = entry.element.offsetHeight;
        }
        dirty = false;
      }
      const done = completed instanceof Set ? completed : new Set(completed);
      camera.updateMatrixWorld(true);
      camera.getWorldPosition(cameraPoint);
      const candidates = [];
      for (const entry of entries) {
        entry.element.hidden = true;
        entry.element.classList.toggle("is-complete", done.has(entry.id));
        entry.element.classList.toggle("is-active", entry.id === activeKey);
        entry.anchor.updateWorldMatrix(true, false);
        const offset = entry.offset || [0, 2.8, 0];
        point.set(...offset);
        entry.anchor.localToWorld(point);
        const distance = point.distanceToSquared(cameraPoint);
        point.project(camera);
        if (point.z < -1 || point.z > 1 || Math.abs(point.x) > 1.08 || Math.abs(point.y) > 1.08) continue;
        candidates.push({entry, distance, x: (point.x * .5 + .5) * width, y: (-point.y * .5 + .5) * height});
      }
      candidates.sort((a, b) => Number(b.entry.id === activeKey) - Number(a.entry.id === activeKey)
        || Number(done.has(a.entry.id)) - Number(done.has(b.entry.id)) || a.distance - b.distance);
      const occupied = [], limit = width < 600 ? 3 : 5;
      for (const candidate of candidates) {
        if (visibleCount >= limit) break;
        const {entry} = candidate, half = entry.width * .5;
        const x = Math.max(half + 10, Math.min(width - half - 10, candidate.x));
        let y = Math.max(entry.height + 38, Math.min(height - 58, candidate.y));
        let bounds;
        for (let attempt = 0; attempt < 4; attempt++) {
          bounds = {left: x - half - 4, right: x + half + 4, top: y - entry.height - 4, bottom: y + 4};
          if (!occupied.some(rect => bounds.left < rect.right && bounds.right > rect.left && bounds.top < rect.bottom && bounds.bottom > rect.top)) break;
          y -= entry.height + 7;
          bounds = null;
          if (y < entry.height + 38) break;
        }
        if (!bounds || y < entry.height + 38) continue;
        entry.element.style.left = `${x}px`; entry.element.style.top = `${y}px`;
        entry.element.hidden = false;
        occupied.push(bounds); visibleCount++;
      }
    }
    return {update, status: () => ({visible: visibleCount, total: entries.length}),
      dispose() { observer?.disconnect(); layer.remove(); parent = null; }};
  }
  window.TrailWorldLabels = Object.freeze({create});
})();
