import type { View } from "../../../src/protocol";
import { waitingOnPublic } from "./controls";

const ALERTING = new Set(["action", "bidding", "decision", "tradeResponse", "payment"]);

export function alertKey(view: View | null): string | null {
  const game = view?.room?.game;
  if (!view?.me || !game || view.room?.status !== "PLAYING") return null;
  const kind = game.phase.kind;
  if (!ALERTING.has(kind) || waitingOnPublic(game.phase) !== view.me.id) return null;
  return `${kind}:${game.deadline}`;
}

export function shouldAlert(prev: string | null, next: string | null): boolean {
  return next !== null && next !== prev;
}
