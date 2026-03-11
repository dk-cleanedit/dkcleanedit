export const qs = (sel, root = document) => root.querySelector(sel);

export function show(el) {
  if (!el) return;
  el.hidden = false;
  el.setAttribute("aria-hidden", "false");
}

export function hide(el) {
  if (!el) return;
  el.hidden = true;
  el.setAttribute("aria-hidden", "true");
}

export function setText(el, text) {
  if (!el) return;
  el.textContent = text ?? "";
}
