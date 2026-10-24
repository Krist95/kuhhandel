import { useState } from "preact/hooks";
import type { RoomView } from "../../../../src/protocol";
import { sendOrToast } from "../../net/socket";
import { ConfirmDialog } from "../ConfirmDialog";

export function TableMenu(props: { room: RoomView; isHost: boolean; onOpen: (panel: "rules" | "log" | "herds") => void; onClose: () => void }) {
  const [confirm, setConfirm] = useState(false);
  if (confirm) {
    return (
      <ConfirmDialog message="Close the room for everyone?" confirmLabel="Close room"
        onConfirm={() => sendOrToast({ type: "closeRoom" })} onCancel={() => setConfirm(false)} />
    );
  }
  const paused = props.room.status === "PAUSED";
  return (
    <div class="dialog-backdrop" role="dialog" aria-modal="true">
      <div class="sheet">
        <button onClick={() => props.onOpen("herds")}>Herds</button>
        <button onClick={() => props.onOpen("rules")}>Rules &amp; settings</button>
        <button onClick={() => props.onOpen("log")}>Log</button>
        {props.isHost && (
          <>
            <button onClick={() => { sendOrToast({ type: paused ? "resume" : "pause" }); props.onClose(); }}>{paused ? "Resume" : "Pause"}</button>
            <button class="danger" onClick={() => setConfirm(true)}>Close room</button>
          </>
        )}
        <button class="secondary" onClick={props.onClose}>Back</button>
      </div>
    </div>
  );
}
