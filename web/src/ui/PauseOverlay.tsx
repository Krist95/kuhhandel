import { useState } from "preact/hooks";
import { sendOrToast } from "../net/socket";
import { ConfirmDialog } from "./ConfirmDialog";

export function PauseOverlay(props: { hostName: string; isHost: boolean }) {
  const [confirm, setConfirm] = useState(false);
  if (confirm) {
    return (
      <ConfirmDialog message="Close the room for everyone?" confirmLabel="Close room"
        onConfirm={() => sendOrToast({ type: "closeRoom" })} onCancel={() => setConfirm(false)} />
    );
  }
  return (
    <div class="dialog-backdrop pause-backdrop" role="dialog" aria-modal="true">
      <div class="dialog">
        <p>Game paused by {props.hostName}</p>
        {props.isHost && (
          <div class="row">
            <button onClick={() => sendOrToast({ type: "resume" })}>Resume</button>
            <button class="danger" onClick={() => setConfirm(true)}>Close room</button>
          </div>
        )}
      </div>
    </div>
  );
}
