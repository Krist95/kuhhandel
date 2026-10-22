import type { TradeReveal } from "../../../src/protocol";
import { animalsText } from "../../../src/rules/text";
import { ANIMAL_NAME, MAX_TIES, type ScoreRow, type Settings } from "../../../src/rules/types";

const SEEN_KEY = "kuhhandel.seenReveals";
type SeenStore = Pick<Storage, "getItem" | "setItem">;
let memory: { roomId: string; ids: number[] } = { roomId: "", ids: [] };

export function revealToShow(reveal: TradeReveal | null, seen: ReadonlySet<number>): TradeReveal | null {
  return reveal !== null && !seen.has(reveal.id) ? reveal : null;
}

export function loadSeen(store: SeenStore | null, roomId: string): Set<number> {
  let raw: string | null | undefined;
  try { raw = store?.getItem(SEEN_KEY); } catch { raw = undefined; /* unreadable: use memory */ }
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { roomId?: unknown; ids?: unknown };
      if (parsed.roomId === roomId && Array.isArray(parsed.ids)) {
        return new Set(parsed.ids.filter((x): x is number => typeof x === "number"));
      }
    } catch { /* malformed */ }
    return new Set();
  }
  return new Set(memory.roomId === roomId ? memory.ids : []);
}

export function markSeen(store: SeenStore | null, roomId: string, id: number): Set<number> {
  const next = loadSeen(store, roomId);
  next.add(id);
  memory = { roomId, ids: [...next] };
  try { store?.setItem(SEEN_KEY, JSON.stringify(memory)); } catch { /* memory only */ }
  return next;
}

export function revealText(r: TradeReveal, meId: string, names: Record<string, string>): string {
  const who = (id: string): string => (id === meId ? "You" : (names[id] ?? "?"));
  const head = `${who(r.challengerId)} ${r.challengerTotal} vs ${who(r.defenderId)} ${r.defenderTotal}.`;
  if (r.winnerId === null) return `${head} Tie (${r.ties + 1} of ${MAX_TIES}).`;
  const verb = r.winnerId === meId ? "win" : "wins";
  return `${head} ${who(r.winnerId)} ${verb} ${animalsText(r.count, r.animal)}.`;
}

export function scoreLine(row: ScoreRow): string {
  if (row.sets.length === 0) return "No complete sets = 0";
  return `${row.sets.map((a) => ANIMAL_NAME[a][0]).join(" + ")} = ${row.setValue} × ${row.multiplier} = ${row.score}`;
}

export function moneyRuleText(rule: Settings["moneyRule"]): string {
  return rule === "swap"
    ? "Swap: the winner takes the loser's offer and the loser takes the winner's."
    : "Loser takes both offers.";
}
