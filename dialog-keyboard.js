"use strict";
// Keep keyboard navigation within the topmost open puzzle or settings panel.
// Resolve live controls each time: puzzles replace and disable their buttons.
(() => {
  const visible = node => node && !node.closest("[hidden]") && node.getClientRects().length > 0;
  document.addEventListener("keydown", event => {
    if(event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) return;
    const panel = ["graphicsPanel", "coastModal", "canyonModal", "dialog"]
      .map(id => document.getElementById(id)).find(visible);
    if(!panel) return;
    const controls = [...panel.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')]
      .filter(node => !node.disabled && node.tabIndex >= 0 && visible(node));
    const first = controls[0], last = controls.at(-1), focused = document.activeElement;
    if(!first) {
      event.preventDefault();
      panel.focus({preventScroll:true});
    } else if(!panel.contains(focused) || focused === panel ||
      (event.shiftKey ? focused === first : focused === last)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus({preventScroll:true});
    }
  }, true);
})();
