import { ROOM_ID_ALPHABET } from "../../../src/rules/types";

/** A fresh candidate room code, generated client-side so the room's Durable Object can be picked before it exists. */
export function newRoomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => ROOM_ID_ALPHABET[b % ROOM_ID_ALPHABET.length]).join("");
}
