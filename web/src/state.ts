import { signal } from "@preact/signals";
import type { ServerMessage, View } from "../../src/protocol";
import type { MoneyCard } from "../../src/rules/types";
import { clockOffset } from "./model/clock";

export const view = signal<View | null>(null);
export const conn = signal<"connecting" | "online" | "offline" | "replaced">("connecting");
export const notice = signal<string | null>(null);
export const toast = signal<string | null>(null);
/** Bumped on every server error, so controls waiting on a reply can re-enable. */
export const errorSeq = signal(0);
export const offset = signal(0);
export const homeScreen = signal<"home" | "create" | "join">("home");
export const picked = signal<string[]>([]);

/** Adds the id if absent, removes it if present. */
export function togglePick(list: readonly string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/** Keeps only the ids still present in the money list, preserving the list's order. */
export function validPicks(list: readonly string[], money: readonly MoneyCard[]): string[] {
  const live = new Set(money.map((m) => m.id));
  return list.filter((id) => live.has(id));
}

const CLOSED_COPY = {
  hostClosed: "The host closed the room.",
  finished: "The room closed after the game ended.",
  inactive: "The room closed because nobody was connected for 10 minutes.",
} as const;

export function onServerMessage(msg: ServerMessage, localNow: number): void {
  switch (msg.type) {
    case "view":
      view.value = msg.view;
      offset.value = clockOffset(msg.view.serverTime, localNow);
      break;
    case "error":
      toast.value = msg.message;
      errorSeq.value++;
      break;
    case "roomClosed":
      // Sent to every socket; a visitor who wasn't in the room (e.g. on the Create form) stays where they are.
      if (!view.value?.room) break;
      notice.value = CLOSED_COPY[msg.reason];
      homeScreen.value = "home";
      break;
    case "removed":
      notice.value = "You were removed from the room.";
      homeScreen.value = "home";
      break;
  }
}
