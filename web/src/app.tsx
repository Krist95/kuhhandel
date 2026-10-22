import { startConnection } from "./net/socket";
import { conn, homeScreen, view } from "./state";
import { EndScreen } from "./ui/EndScreen";
import { Toast } from "./ui/Toast";
import { Home } from "./ui/Home";
import { Lobby } from "./ui/Lobby";
import { Table } from "./ui/Table";
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
    case "PAUSED": return <Table room={v.room} />;
    case "FINISHED": return <><EndScreen room={v.room} /><Toast /></>;
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
