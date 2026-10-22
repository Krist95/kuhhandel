import { reduce } from "../../src/rules/engine";
import type { ErrorCode } from "../../src/rules/errors";
import { mulberry32 } from "../../src/rules/rng";
import type { Action, Intent, Outcome, Player, Room } from "../../src/rules/types";

export const T0 = 1_000_000;
export const NAMES = ["Anna", "Ben", "Clara"];
export const tok = (name: string) => `tok-${name.toLowerCase()}`;

export function outcome(room: Room | null, action: Action, now = T0, seed = 1): Outcome {
  return reduce(room, action, { now, rng: mulberry32(seed) });
}
export function run(room: Room | null, action: Action, now = T0, seed = 1): Room | null {
  const o = outcome(room, action, now, seed);
  if (!o.ok) throw new Error(o.error.code);
  return o.state;
}
export function fail(room: Room | null, action: Action, now = T0): ErrorCode {
  const o = outcome(room, action, now);
  if (o.ok) throw new Error("expected failure");
  return o.error.code;
}
export const by = (name: string, intent: Intent): Action => ({ type: "intent", token: tok(name), intent });
export const createAction = (name = "Anna", seat = 1): Action =>
  ({ type: "create", token: tok(name), roomName: "Barn", playerName: name, seat, passwordHash: "h", passwordSalt: "s" });
export const joinAction = (name: string, seat: number): Action => ({ type: "join", token: tok(name), playerName: name, seat });
export function lobby(names = NAMES): Room {
  let r = run(null, createAction(names[0], 1));
  for (let i = 1; i < names.length; i++) r = run(r, joinAction(names[i], i + 1));
  return r!;
}
export function pl(room: Room, name: string): Player {
  const p = room.players.find((x) => x.name === name);
  if (!p) throw new Error(`no player ${name}`);
  return p;
}
