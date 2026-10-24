import { effect } from "@preact/signals";
import { render } from "preact";
import { App } from "./app";
import { playTurnAlert, unlockAudio } from "./device/alert";
import { registerServiceWorker, tryLockLandscape } from "./device/pwa";
import { keepAwake } from "./device/wakeLock";
import { alertKey, shouldAlert } from "./model/alerts";
import { startConnection } from "./net/socket";
import { homeScreen, view } from "./state";
import "./styles.css";
import "./styles/tokens.css";
import "./styles/table.css";

const joinMatch = /^\/join\/([A-Z0-9]{6})$/i.exec(location.pathname);
if (joinMatch) homeScreen.value = { join: joinMatch[1]!.toUpperCase() };

render(<App />, document.getElementById("app")!);
// The dev table scenes (?table) run on fixtures; a live connection would overwrite their view.
if (!(import.meta.env.DEV && new URLSearchParams(location.search).has("table"))) startConnection();

let prevKey: string | null = null;
effect(() => {
  const next = alertKey(view.value);
  if (shouldAlert(prevKey, next)) playTurnAlert();
  prevKey = next;
});
effect(() => {
  const status = view.value?.room?.status;
  keepAwake(status === "PLAYING" || status === "PAUSED");
});
registerServiceWorker();
window.addEventListener("pointerdown", () => { unlockAudio(); tryLockLandscape(); }, { once: true });
