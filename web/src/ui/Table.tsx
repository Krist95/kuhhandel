import { useState } from "preact/hooks";
import type { RoomView } from "../../../src/protocol";
import { seatPositions, type Pos } from "../model/layout";
import { loadSeen, markSeen, revealToShow } from "../model/reveals";
import { view } from "../state";
import { ActionBar } from "./ActionBar";
import { BluffOverlay } from "./BluffOverlay";
import { Center } from "./Center";
import { GameLog } from "./GameLog";
import { HostMenu } from "./HostMenu";
import { MyArea } from "./MyArea";
import { OpponentPanel } from "./OpponentPanel";
import { PauseOverlay } from "./PauseOverlay";
import { RulesScreen } from "./RulesScreen";
import { Toast } from "./Toast";
import { TradeRevealModal } from "./TradeRevealModal";

function seenStore(): Storage | null {
  try { return sessionStorage; } catch { return null; }
}

export function Table(props: { room: RoomView }) {
  const { room } = props;
  const game = room.game;
  const [panel, setPanel] = useState<"rules" | "log" | "host" | null>(null);
  const [seen, setSeen] = useState<Set<number>>(() => loadSeen(seenStore(), room.roomId));
  const meId = view.value?.me?.id ?? "";
  if (game === null) return null;
  const places = seatPositions(room.players, meId);
  const me = room.players.find((p) => p.id === meId);
  const names: Record<string, string> = Object.fromEntries(room.players.map((p) => [p.id, p.name]));
  const reveal = revealToShow(view.value?.me?.tradeReveal ?? null, seen);
  const at = (pos: Pos) => {
    const id = places.find((x) => x.pos === pos)?.id;
    const p = room.players.find((q) => q.id === id);
    return p ? <OpponentPanel player={p} isHost={p.id === room.hostId} isTurn={p.id === game.activePlayerId} /> : null;
  };
  return (
    <div class={`table${room.status === "PAUSED" ? " paused-table" : ""}`}>
      <div class="corner">
        <button class="small secondary" aria-label="Info" onClick={() => setPanel("rules")}>i</button>
        <button class="small secondary" aria-label="Log" onClick={() => setPanel(panel === "log" ? null : "log")}>Log</button>
        {meId === room.hostId && <button class="small secondary" aria-label="Host menu" onClick={() => setPanel("host")}>Host</button>}
      </div>
      <div class="cell c1 r1">{at("topLeft")}</div>
      <div class="cell c2 r1">{at("top")}</div>
      <div class="cell c3 r1">{at("topRight")}</div>
      <div class="cell c1 r2">{at("left")}</div>
      <div class="cell c2 r2"><Center room={room} game={game} /></div>
      <div class="cell c3 r2">{at("right")}</div>
      <div class="cell my r3">{me && <MyArea player={me} />}</div>
      <div class="action-cell cell c3 r3"><ActionBar /></div>
      {panel === "log" && <GameLog log={room.log} onClose={() => setPanel(null)} />}
      {panel === "rules" && <RulesScreen settings={room.settings} onClose={() => setPanel(null)} />}
      {panel === "host" && <HostMenu status={room.status} onClose={() => setPanel(null)} />}
      {room.status === "PLAYING" && <BluffOverlay room={room} game={game} />}
      {room.status === "PLAYING" && reveal && (
        <TradeRevealModal reveal={reveal} meId={meId} names={names} onOk={() => setSeen(markSeen(seenStore(), room.roomId, reveal.id))} />
      )}
      {room.status === "PAUSED" && <PauseOverlay hostName={names[room.hostId] ?? "?"} isHost={meId === room.hostId} />}
      <Toast />
    </div>
  );
}
