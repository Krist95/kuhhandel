import type { TradeReveal } from "../../../src/protocol";
import { animalsText } from "../../../src/rules/text";
import { ANIMAL_NAME, MAX_TIES, type ScoreRow, type Settings } from "../../../src/rules/types";

const SEEN_KEY = "kuhhandel.seenReveals";
let memory: number[] = [];

export function revealToShow(reveal: TradeReveal | null, seen: ReadonlySet<number>): TradeReveal | null {
  return reveal !== null && !seen.has(reveal.id) ? reveal : null;
}

export function loadSeen(): Set<number> {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) memory = parsed.filter((x): x is number => typeof x === "number");
    }
  } catch { /* fall back to memory */ }
  return new Set(memory);
}

export function markSeen(id: number): Set<number> {
  const next = loadSeen();
  next.add(id);
  memory = [...next];
  try { sessionStorage.setItem(SEEN_KEY, JSON.stringify(memory)); } catch { /* memory only */ }
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
