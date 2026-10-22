import type { MoneyValue } from "../../../src/rules/types";
import { NOTE_ART } from "../art";

export function MoneyNote(props: { value: MoneyValue; size: "chip" | "card" }) {
  return <img class={`money-note ${props.size}`} src={NOTE_ART[props.value]} alt={String(props.value)} />;
}
