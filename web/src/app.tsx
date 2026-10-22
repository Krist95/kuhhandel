import { startConnection } from "./net/socket";
import { conn, homeScreen, view } from "./state";
import { Home } from "./ui/Home";
import { Lobby } from "./ui/Lobby";
import { RoomForm } from "./ui/RoomForm";
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
  if (v.room === null) return homeScreen.value === "home" ? <Home /> : <RoomForm mode={homeScreen.value} />;
  switch (v.room.status) {
    case "LOBBY": return <Lobby room={v.room} />;
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
