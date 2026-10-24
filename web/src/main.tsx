import { effect } from "@preact/signals";
import { render } from "preact";
import { App } from "./app";
import { playTurnAlert, unlockAudio } from "./device/alert";
import { registerServiceWorker, tryLockLandscape } from "./device/pwa";
import { keepAwake } from "./device/wakeLock";
import { alertKey, shouldAlert } from "./model/alerts";
import { clearRoomId, loadRoomId, saveRoomId } from "./net/roomSession";
import { startConnection } from "./net/socket";
import { homeScreen, view } from "./state";
import "./styles.css";
import "./styles/tokens.css";
import "./styles/table.css";

const joinMatch = /^\/join\/([A-Z0-9]{6})$/i.exec(location.pathname);
const storage = (): Storage | null => { try { return localStorage; } catch { return null; } };

render(<App />, document.getElementById("app")!);
// The dev table scenes (?table) run on fixtures; a live connection would overwrite their view.
if (!(import.meta.env.DEV && new URLSearchParams(location.search).has("table"))) {
  if (joinMatch) {
    const roomId = joinMatch[1]!.toUpperCase();
    homeScreen.value = { join: roomId };
    startConnection(roomId);
  } else {
    const saved = loadRoomId(storage());
    if (saved) startConnection(saved);
    // else: no target yet — conn stays "idle", Screen() shows Home until Create/Join picks a room.
  }

  // Remember the room this player is in, so a reload rejoins it. `undefined` means no view has arrived yet,
  // so the first view with no room (e.g. the saved room died while away) still clears the stale id.
  let lastRoomId: string | null | undefined = undefined;
  effect(() => {
    const v = view.value;
    if (v === null) return;
    const roomId = v.room?.roomId ?? null;
    if (roomId === lastRoomId) return;
    lastRoomId = roomId;
    if (roomId) saveRoomId(storage(), roomId); else clearRoomId(storage());
  });
}

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
