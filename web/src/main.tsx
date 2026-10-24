import { effect } from "@preact/signals";
import { render } from "preact";
import { App } from "./app";
import { playTurnAlert, unlockAudio } from "./device/alert";
import { registerServiceWorker, tryLockLandscape } from "./device/pwa";
import { keepAwake } from "./device/wakeLock";
import { alertKey, shouldAlert } from "./model/alerts";
import { decideStartup } from "./model/startup";
import { clearRoomId, loadRoomId, saveRoomId } from "./net/roomSession";
import { startConnection } from "./net/socket";
import { homeScreen, notice, view } from "./state";
import "./styles.css";
import "./styles/tokens.css";
import "./styles/table.css";

const storage = (): Storage | null => { try { return localStorage; } catch { return null; } };

render(<App />, document.getElementById("app")!);
// The dev table scenes (?table) run on fixtures; a live connection would overwrite their view.
if (!(import.meta.env.DEV && new URLSearchParams(location.search).has("table"))) {
  const saved = loadRoomId(storage());
  const decision = decideStartup(location.pathname, saved);

  // A `/join/...` URL is single-use: whether it was just used, or is stale/malformed and we fell
  // back to the saved room, it must never be able to win a future reload (see Finding 1).
  if (decision.clearUrl) history.replaceState(null, "", "/");

  // True only when we're resuming a session from storage rather than a fresh join link — used below
  // to show a notice if that saved room turns out to be gone.
  const resumingSaved = decision.roomId !== null && decision.roomId === saved;

  if (decision.roomId) {
    if (!resumingSaved) homeScreen.value = { join: decision.roomId };
    startConnection(decision.roomId);
  }
  // else: no target yet — conn stays "idle", Screen() shows Home until Create/Join picks a room.

  // Remember the room this player is in, so a reload rejoins it. `undefined` means no view has arrived yet,
  // so the first view with no room (e.g. the saved room died while away) still clears the stale id.
  let lastRoomId: string | null | undefined = undefined;
  let firstView = true;
  effect(() => {
    const v = view.value;
    if (v === null) return;
    const roomId = v.room?.roomId ?? null;
    if (firstView) {
      firstView = false;
      // We tried to resume a saved session at startup and it turned out to be dead — tell the player
      // instead of silently dropping them on Home (Finding 3). A normal leave-seat later in the
      // session clears the saved id too, but shouldn't trigger this notice.
      if (resumingSaved && roomId === null) notice.value = "That room is no longer available.";
    }
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
