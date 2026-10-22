import { send } from "../net/socket";

export function PauseOverlay(props: { hostName: string; isHost: boolean }) {
  return (
    <div class="dialog-backdrop pause-backdrop" role="dialog" aria-modal="true">
      <div class="dialog">
        <p>Game paused by {props.hostName}</p>
        {props.isHost && <button onClick={() => send({ type: "resume" })}>Resume</button>}
      </div>
    </div>
  );
}
