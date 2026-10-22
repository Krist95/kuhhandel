import { useState } from "preact/hooks";
import type { MoneyCard } from "../../../src/rules/types";
import { view } from "../state";
import { MoneyNote } from "./MoneyNote";

export type PickerMode = "view" | "pay" | "offer" | "counter";

export function MoneyPicker(props: {
  mode: PickerMode;
  owed?: number;
  note?: string;
  onSubmit?: (cardIds: string[]) => void;
  onNothing?: () => void;
  onClose: () => void;
}) {
  const { mode, owed = 0 } = props;
  const money: MoneyCard[] = [...(view.value?.me?.money ?? [])].sort((a, b) => a.value - b.value || a.id.localeCompare(b.id));
  const [picked, setPicked] = useState<string[]>([]);
  const total = money.filter((m) => picked.includes(m.id)).reduce((n, m) => n + m.value, 0);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const label = mode === "pay" ? "Pay" : mode === "offer" ? "Offer" : "Counter";
  const ready = mode === "pay" ? total >= owed : picked.length > 0;
  return (
    <div class="overlay picker" role="dialog" aria-label="Your money">
      <div class="sheet">
        {props.note && <div class="hint">{props.note}</div>}
        <div class="money-cards">
          {money.length === 0 && <span class="hint">No money</span>}
          {money.map((m) => (
            <button
              key={m.id}
              class={`money-card${picked.includes(m.id) ? " selected" : ""}`}
              disabled={mode === "view"}
              aria-pressed={picked.includes(m.id)}
              onClick={() => toggle(m.id)}
            ><MoneyNote value={m.value} size="chip" /></button>
          ))}
        </div>
        {mode === "pay" && <div class="total">Selected {total} / Owed {owed}</div>}
        {(mode === "offer" || mode === "counter") && <div class="total">Selected {total} · {picked.length} {picked.length === 1 ? "card" : "cards"}</div>}
        <div class="sheet-buttons">
          {mode !== "view" && <button disabled={!ready} onClick={() => props.onSubmit?.(picked)}>{label}</button>}
          {mode === "counter" && <button class="secondary" onClick={() => props.onNothing?.()}>Put nothing</button>}
          <button class="secondary" onClick={props.onClose}>{mode === "view" ? "Close" : "Cancel"}</button>
        </div>
      </div>
    </div>
  );
}
