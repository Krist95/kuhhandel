import { reduce, type Tx } from "../../src/rules/engine";
import { herdOf } from "../../src/rules/herd";
import { beginTurn } from "../../src/rules/turn";
import type { ErrorCode } from "../../src/rules/errors";
import { mulberry32 } from "../../src/rules/rng";
import type { Action, Animal, Auction, Herd, Intent, MoneyValue, Outcome, Player, Room, Settings } from "../../src/rules/types";

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
export const createAction = (name = "Anna"): Action => ({ type: "create", token: tok(name), roomId: "ab12cd", roomName: "Barn", playerName: name });
export const updateSettingsAction = (name: string, patch: { moneyRule?: unknown; decisionSeconds?: unknown }): Action =>
  ({ type: "intent", token: tok(name), intent: { type: "updateSettings", ...patch } as never });
export const joinAction = (name: string): Action => ({ type: "join", token: tok(name), playerName: name });
export function lobby(names = NAMES): Room {
  let r = run(null, createAction(names[0]));
  for (let i = 1; i < names.length; i++) r = run(r, joinAction(names[i]));
  return r!;
}
export function pl(room: Room, name: string): Player {
  const p = room.players.find((x) => x.name === name);
  if (!p) throw new Error(`no player ${name}`);
  return p;
}

export interface GameOpts {
  deck?: Animal[]; first?: string; money?: Record<string, MoneyValue[]>;
  herds?: Record<string, Partial<Herd>>; settings?: Partial<Settings>;
}
export function withTx(room: Room, fn: (draft: Room, tx: Tx) => void, now = T0): Room {
  const draft: Room = JSON.parse(JSON.stringify(room));
  fn(draft, { now, rng: mulberry32(1), events: [] });
  return draft;
}
export function game(names = NAMES, o: GameOpts = {}): Room {
  let r = run(null, createAction(names[0]));
  for (let i = 1; i < names.length; i++) r = run(r, joinAction(names[i]));
  if (o.settings) r = run(r, updateSettingsAction(names[0], o.settings));
  return withTx(run(r, by(names[0], { type: "startGame" }))!, (d, tx) => {
    if (o.deck) d.game!.deck = [...o.deck];
    for (const [name, values] of Object.entries(o.money ?? {})) pl(d, name).money = values.map((value, i) => ({ id: `${name}-${i + 1}`, value }));
    for (const [name, h] of Object.entries(o.herds ?? {})) pl(d, name).herd = herdOf(h);
    beginTurn(d, idOf(d, o.first ?? names[0]), tx);
  });
}
export function act(room: Room, name: string, intent: Intent, now = T0): Room {
  return run(room, by(name, intent), now)!;
}
export function reject(room: Room, name: string, intent: Intent, now = T0): ErrorCode {
  return fail(room, by(name, intent), now);
}
export const idOf = (r: Room, name: string) => pl(r, name).id;
export function nameOf(room: Room, id: string): string {
  const p = room.players.find((x) => x.id === id);
  if (!p) throw new Error(`no player ${id}`);
  return p.name;
}
export function ids(room: Room, name: string, ...values: MoneyValue[]): string[] {
  const used = new Set<string>();
  return values.map((v) => {
    const c = pl(room, name).money.find((m) => m.value === v && !used.has(m.id));
    if (!c) throw new Error(`${name} has no unused ${v} card`);
    used.add(c.id);
    return c.id;
  });
}
export function cash(room: Room, name: string): number {
  return pl(room, name).money.reduce((n, c) => n + c.value, 0);
}
export function count(room: Room, name: string, animal: Animal): number {
  return pl(room, name).herd[animal];
}

export function auc(room: Room): Auction {
  const phase = room.game!.phase;
  if (phase.kind !== "bidding" && phase.kind !== "decision" && phase.kind !== "bluff") throw new Error(`no auction in phase ${phase.kind}`);
  return phase.auction;
}
export function tickAt(room: Room | null, now: number): Room | null {
  return run(room, { type: "tick" }, now);
}
export function passAll(room: Room, now = T0): Room {
  let r = room;
  while (r.game!.phase.kind === "bidding") r = act(r, nameOf(r, r.game!.phase.auction.turnId!), { type: "pass" }, now);
  return r;
}
