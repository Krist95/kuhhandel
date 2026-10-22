import { effect } from "@preact/signals";
import { render } from "preact";
import { App } from "./app";
import { playTurnAlert, unlockAudio } from "./device/alert";
import { registerServiceWorker, tryLockLandscape } from "./device/pwa";
import { keepAwake } from "./device/wakeLock";
import { alertKey, shouldAlert } from "./model/alerts";
import { startConnection } from "./net/socket";
import { view } from "./state";
import "./styles.css";

render(<App />, document.getElementById("app")!);
startConnection();

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
