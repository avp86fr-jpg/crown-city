import { boot } from "./game.js";

boot().catch((err) => {
  console.error(err);
  const el = document.createElement("pre");
  el.style.cssText = "color:#f66;padding:24px;white-space:pre-wrap;font:14px monospace";
  el.textContent = "CROWN CITY failed to start:\n" + (err && err.stack ? err.stack : String(err));
  document.body.appendChild(el);
});
