import { boot } from "./game.js";

boot().catch((err) => {
  console.error(err);
  const el = document.createElement("section");
  el.id = "bootError";
  el.setAttribute("role", "alert");
  const title = document.createElement("h1"); title.textContent = "Crown City couldn't load.";
  const text = document.createElement("p"); text.textContent = "Check your connection and retry. Your saved game stays on this device.";
  const retry = document.createElement("button"); retry.textContent = "RETRY"; retry.type = "button";
  retry.addEventListener("click", () => window.location.reload());
  const help = document.createElement("a"); help.textContent = "Controls and game guide"; help.href = "about/#play";
  el.append(title, text, retry, help);
  document.body.appendChild(el);
});
