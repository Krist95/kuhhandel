import { useCallback, useLayoutEffect, useRef, useState } from "preact/hooks";
import type { RoomView } from "../../../src/protocol";
import { deriveControls, waitingOnPublic } from "../model/controls";
import { fitTable } from "../model/fit";
import { railOrder } from "../model/layout";
import { loadSeen, markSeen, revealToShow } from "../model/reveals";
import { intro } from "../model/stage";
import { view } from "../state";
import { BluffOverlay } from "./BluffOverlay";
import { GameLog } from "./GameLog";
import { PauseOverlay } from "./PauseOverlay";
import { RulesScreen } from "./RulesScreen";
import { Toast } from "./Toast";
import { seenStore, TradeRevealModal } from "./TradeRevealModal";
import { ActionDock, dockHandMode } from "./table/ActionDock";
import { GameStart } from "./table/GameStart";
import { Hand } from "./table/Hand";
import { HerdBoard } from "./table/HerdBoard";
import { LogTicker } from "./table/LogTicker";
import { SeatPod } from "./table/SeatPod";
import { Stage } from "./table/Stage";
import { TableMenu } from "./table/TableMenu";

type Panel = "menu" | "rules" | "log" | "herds" | null;
type Fit = { scale: number; width: number; height: number };

/** Fits the design canvas to the `.kh-frame` content box; keeps the last good fit while the box is 0 wide or tall. */
function useFit(): [(el: HTMLDivElement | null) => void, Fit | null] {
  const [fit, setFit] = useState<Fit | null>(null);
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const box = entries[entries.length - 1].contentRect;
      if (box.width <= 0 || box.height <= 0) return;
      const next = fitTable(box.width, box.height);
      setFit((prev) => (prev && prev.scale === next.scale && prev.width === next.width ? prev : next));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, fit];
}

export function Table(props: { room: RoomView; initialPanel?: "herds"; initialFocusId?: string }) {
  const { room } = props;
  const game = room.game;
  const [panel, setPanel] = useState<Panel>(props.initialPanel ?? null);
  const [focusId, setFocusId] = useState<string | null>(props.initialFocusId ?? null);
  const [seen, setSeen] = useState<Set<number>>(() => loadSeen(seenStore(), room.roomId));
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
  const introKey = useRef<string | null>(null);
  const dismissIntro = useCallback(() => {
    const k = introKey.current;
    if (k !== null) setDismissed((s) => new Set(s).add(k));
  }, []);
  const [frameRef, fit] = useFit();
  const v = view.value;
  const meId = v?.me?.id ?? "";
  if (game === null || v === null) return null;

  const me = room.players.find((p) => p.id === meId);
  const isHost = meId === room.hostId;
  const paused = room.status === "PAUSED";
  const names: Record<string, string> = Object.fromEntries(room.players.map((p) => [p.id, p.name]));
  const reveal = revealToShow(v.me?.tradeReveal ?? null, seen);
  const ph = game.phase;
  const active = waitingOnPublic(ph);
  const sitting = ph.kind === "bidding" || ph.kind === "decision" ? [...ph.passed, ...ph.excluded] : [];
  const controls = deriveControls(v);
  const intr = intro(v);
  introKey.current = intr?.key ?? null;
  const showIntro = intr !== null && !dismissed.has(intr.key);
  const openHerds = (id: string | null) => { setFocusId(id); setPanel("herds"); };
  const close = () => setPanel(null);

  return (
    <>
      <div class="kh-frame" ref={frameRef}>
        {fit && (
          <div class="kh-canvas" style={{ width: `${fit.width}px`, height: `${fit.height}px`, transform: `scale(${fit.scale})` }}>
            <div class={`kh kh-table${paused ? " paused-table" : ""}`}>
              <div class="rail">
                {railOrder(room.players, meId).map((p) => (
                  <SeatPod key={p.id} player={p} isHost={p.id === room.hostId} active={active === p.id} dim={sitting.includes(p.id)}
                    deadline={game.deadline} decisionSeconds={room.settings.decisionSeconds} paused={paused} onOpen={() => openHerds(p.id)} />
                ))}
                <button class="menu" aria-label="Menu" onClick={() => setPanel("menu")}>⋯</button>
              </div>
              <LogTicker log={room.log} onOpen={() => setPanel("log")} />
              <Stage room={room} game={game} meId={meId} />
              {me && (
                <Hand player={me} money={v.me?.money ?? []} mode={dockHandMode(controls)}
                  owed={controls.kind === "pay" ? controls.amount : undefined} onOpenHerds={() => openHerds(null)} />
              )}
              <ActionDock room={room} meId={meId} />
              {panel === "herds" && <HerdBoard room={room} meId={meId} focusId={focusId} onClose={close} />}
              {showIntro && <GameStart key={intr.key} view={v} onDone={dismissIntro} />}
            </div>
          </div>
        )}
      </div>
      {/* Outside the scaled canvas: these stay full-screen, and the paused filter does not dim them. */}
      {panel === "menu" && <TableMenu room={room} isHost={isHost} onOpen={(p) => (p === "herds" ? openHerds(null) : setPanel(p))} onClose={close} />}
      {panel === "log" && <GameLog log={room.log} onClose={close} />}
      {panel === "rules" && <RulesScreen settings={room.settings} onClose={close} />}
      {room.status === "PLAYING" && <BluffOverlay room={room} game={game} />}
      {room.status === "PLAYING" && reveal && (
        <TradeRevealModal reveal={reveal} meId={meId} names={names} onOk={() => setSeen(markSeen(seenStore(), room.roomId, reveal.id))} />
      )}
      {paused && <PauseOverlay hostName={names[room.hostId] ?? "?"} isHost={isHost} />}
      <Toast />
    </>
  );
}
