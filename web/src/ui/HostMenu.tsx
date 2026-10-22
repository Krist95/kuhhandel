import { useState } from "preact/hooks";
import type { RoomStatus } from "../../../src/rules/types";
import { send } from "../net/socket";
import { ConfirmDialog } from "./ConfirmDialog";

export function HostMenu(props: { status: RoomStatus; onClose: () => void }) {
  const [confirm, setConfirm] = useState(false);
  if (confirm) {
    return (
      <ConfirmDialog message="Close the room for everyone?" confirmLabel="Close room"
        onConfirm={() => send({ type: "closeRoom" })} onCancel={() => setConfirm(false)} />
    );
  }
  const paused = props.status === "PAUSED";
  return (
    <div class="dialog-backdrop" role="dialog" aria-modal="true">
      <div class="dialog">
        <div class="row">
          <button onClick={() => { send({ type: paused ? "resume" : "pause" }); props.onClose(); }}>{paused ? "Resume" : "Pause"}</button>
          <button class="danger" onClick={() => setConfirm(true)}>Close room</button>
          <button class="secondary" onClick={props.onClose}>Back</button>
        </div>
      </div>
    </div>
  );
}
