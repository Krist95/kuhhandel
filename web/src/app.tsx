import { startConnection } from "./net/socket";
import { conn, view } from "./state";
import { RotateOverlay } from "./ui/RotateOverlay";

function Screen() {
  const v = view.value;
  if (conn.value === "replaced") {
    return (
      <div class="center">
        <p>This game is open in another tab or window.</p>
        <button onClick={() => startConnection()}>Use here</button>
      </div>
    );
  }
  if (v === null) return <div class="center">Connecting…</div>;
  if (v.room === null) return <div class="center">Home (Task 14)</div>;
  switch (v.room.status) {
    case "LOBBY": return <div class="center">Lobby (Task 14)</div>;
    case "PLAYING":
    case "PAUSED": return <div class="center">Table (Task 15)</div>;
    case "FINISHED": return <div class="center">End screen (Task 17)</div>;
  }
}

export function App() {
  return (
    <>
      <Screen />
      <RotateOverlay />
    </>
  );
}
