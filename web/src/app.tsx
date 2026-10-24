import { TableScenes } from "./dev/TableScenes";
import { startConnection } from "./net/socket";
import { conn, homeScreen, view } from "./state";
import { ArtPreview } from "./ui/ArtPreview";
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
  // The last view stays on screen while the socket is down, so say that it may be stale.
  const badge = conn.value !== "online" && <div class="conn-badge" role="status">Reconnecting…</div>;
  switch (v.room.status) {
    case "LOBBY": return <><Lobby room={v.room} />{badge}</>;
    case "PLAYING":
    case "PAUSED": return <><Table room={v.room} />{badge}</>;
    case "FINISHED": return <><EndScreen room={v.room} /><Toast />{badge}</>;
  }
}

export function App() {
  // Dev-only art review page (http://localhost:5173/?art); the DEV check removes it from production builds.
  if (import.meta.env.DEV && new URLSearchParams(location.search).has("art")) return <ArtPreview />;
  // Dev-only table scenes (http://localhost:5173/?table=<name>), rendered from fixtures with no server.
  if (import.meta.env.DEV && new URLSearchParams(location.search).has("table")) return <TableScenes />;
  return (
    <>
      <Screen />
      <RotateOverlay />
    </>
  );
}
