"use strict";
/* Keep canvas labels on the same font stack as the HTML interface. */
(() => {
  const family = getComputedStyle(document.documentElement).getPropertyValue("--font-ui").trim();
  // Font failure keeps the fallback stack usable. Gameplay never waits for this.
  const ready = document.fonts
    ? document.fonts.load('700 16px "Nunito Sans"').catch(() => [])
    : Promise.resolve([]);
  window.TrailTypography = Object.freeze({family, ready});
})();
