import { signal } from "@preact/signals";
import type { ServerMessage, View } from "../../src/protocol";
import { clockOffset } from "./model/clock";

export const view = signal<View | null>(null);
export const conn = signal<"connecting" | "online" | "offline" | "replaced">("connecting");
export const notice = signal<string | null>(null);
export const toast = signal<string | null>(null);
export const offset = signal(0);
export const homeScreen = signal<"home" | "create" | "join">("home");

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
