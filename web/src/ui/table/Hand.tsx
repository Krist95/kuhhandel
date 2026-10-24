import { useEffect, useRef, useState } from "preact/hooks";
import type { PublicPlayer } from "../../../../src/protocol";
import type { MoneyCard } from "../../../../src/rules/types";
import { herdChips, noteOverlap } from "../../model/money";
import { picked, togglePick, validPicks } from "../../state";
import { AnimalChip, AnimalTile } from "./Animals";
import { NoteButton } from "./Money";

type Mode = "view" | "pay" | "offer" | "counter";

function caption(mode: Mode, n: number): string {
  if (mode === "pay") return "Selected";
  const label = mode === "offer" ? "Offer" : "Counter";
  return `${label} · ${n} ${n === 1 ? "card" : "cards"}`;
}

export function Hand(props: { player: PublicPlayer; money: readonly MoneyCard[]; mode: Mode; owed?: number; onOpenHerds: () => void }) {
  const { player, money, mode, owed, onOpenHerds } = props;
  const picking = mode !== "view";
  const ids = money.map((m) => m.id).join(",");

  useEffect(() => {
    const next = validPicks(picked.value, money);
    if (next.length !== picked.value.length) picked.value = next;
  }, [ids]);

  // Width the notes may use, in unscaled canvas px (layout size, not the scaled screen size).
  const notesRef = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState<number | null>(null);
  useEffect(() => {
    const el = notesRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setAvail(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const chips = herdChips(player.herd);
  const tiles = chips.length > 4;
  const notes = [...money].sort((a, b) => a.value - b.value || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const sel = money.filter((m) => picked.value.includes(m.id));
  const selSum = sel.reduce((n, m) => n + m.value, 0);
  const total = money.reduce((n, m) => n + m.value, 0);
  const fit = avail === null ? { overlap: 0, scroll: false } : noteOverlap(notes.length, avail);

  return (
    <div class={`kh-hand${picking ? " picking" : ""}`}>
      <div class={`herdrow${tiles ? " tiles" : ""}`} onClick={onOpenHerds}>
        {chips.length
          ? chips.map((c) => (tiles ? <AnimalTile key={c.animal} animal={c.animal} count={c.count} /> : <AnimalChip key={c.animal} animal={c.animal} count={c.count} />))
          : <span class="kh-hint">Your animals land here.</span>}
      </div>
      <div class="money">
        <div ref={notesRef} class={`notes${fit.overlap > 0 ? " packed" : ""}${fit.scroll ? " scroll" : ""}`} style={{ "--ov": `${fit.overlap}px` } as any}>
          {/* Earlier notes sit on top, so each overlapped note still shows its right half — where the number is. */}
          {notes.map((card, i) => (
            <NoteButton key={card.id} card={card} layer={picked.value.includes(card.id) ? notes.length + 1 : notes.length - i} pressed={picked.value.includes(card.id)} disabled={!picking} onToggle={() => { picked.value = togglePick(picked.value, card.id); }} />
          ))}
        </div>
        {picking ? (
          <span class="sum">
            <span class="kh-cap">{caption(mode, sel.length)}</span>
            <b class="sel">{selSum}{owed ? <span style="color:var(--muted);font-weight:600;font-size:13px"> / {owed}</span> : null}</b>
          </span>
        ) : (
          <span class="sum"><span class="kh-cap">Cash</span><b>{total}</b></span>
        )}
      </div>
    </div>
  );
}
