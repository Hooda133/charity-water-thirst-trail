"use strict";
/*
 * Scroll-aware chapter presentation.
 * Keep the world in view beside longer quest logs on wide, tall displays,
 * but never pin a world that would be taller than the actual viewport.
 * Native document scrolling remains browser-controlled.
 */
(() => {
  const configs = [
    ["gameScreen", ".canvas-column", ".sidebar"],
    ["canyonScreen", ".canyon-stage", ".canyon-sidebar"],
    ["coastScreen", ".coast-stage", ".coast-sidebar"]
  ];
  const visible = screen => !!screen && !screen.hidden;
  const canStick = () => window.matchMedia(
    "(min-width: 1100px) and (min-height: 760px) and (pointer: fine)"
  ).matches;
  const entries = [];
  let scheduled = false;
  function refresh() {
    scheduled = false;
    const wide = canStick();
    for (const {screen, world, sidebar} of entries) {
      if (!world || !sidebar) continue;
      // Read intrinsic heights before toggling. The sidebar must actually be
      // taller, otherwise sticky positioning would add no value.
      const worldHeight = world.getBoundingClientRect().height;
      const logHeight = sidebar.getBoundingClientRect().height;
      const fit = wide && visible(screen) &&
        worldHeight > 0 && worldHeight <= window.innerHeight - 32 &&
        logHeight > worldHeight + 36;
      world.classList.toggle("scroll-sticky-active", fit);
    }
  }
  function schedule() {
    if(scheduled)return;
    scheduled=true;
    window.requestAnimationFrame(refresh);
  }
  function init() {
    const observer = typeof ResizeObserver === "function"
      ? new ResizeObserver(schedule) : null;
    const mutation = typeof MutationObserver === "function"
      ? new MutationObserver(schedule) : null;
    for(const [id,worldSelector,sidebarSelector] of configs){
      const screen=document.getElementById(id);
      const world=screen?.querySelector(worldSelector);
      const sidebar=screen?.querySelector(sidebarSelector);
      if(!screen||!world||!sidebar)continue;
      entries.push({screen,world,sidebar});
      observer?.observe(world);
      observer?.observe(sidebar);
      mutation?.observe(screen,{attributes:true,attributeFilter:["hidden","class"]});
    }
    window.addEventListener("resize",schedule,{passive:true});
    window.addEventListener("orientationchange",schedule,{passive:true});
    window.visualViewport?.addEventListener?.("resize",schedule,{passive:true});
    document.addEventListener("visibilitychange",schedule);
    schedule();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
  // Diagnostics for cross-size smoke tests; no game logic or saved data.
  window.TrailScrollLayout=Object.freeze({
    refresh:schedule,
    status:()=>entries.map(({screen,world})=>({
      chapter:screen.id,active:visible(screen),
      sticky:world.classList.contains("scroll-sticky-active")
    }))
  });
})();
