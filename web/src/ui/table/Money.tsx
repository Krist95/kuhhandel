import type { MoneyCard, MoneyValue } from "../../../../src/rules/types";
import { CARD_BACK, NOTE_ART } from "../../art";

export function Note(props: { value: MoneyValue; size?: "md" | "sm" }) {
  return <img class={`kh-note${props.size === "sm" ? " sm" : ""}`} src={NOTE_ART[props.value]} alt={String(props.value)} />;
}

export function NoteButton(props: { card: MoneyCard; pressed: boolean; disabled: boolean; onToggle: () => void; layer?: number }) {
  return (
    <button class="kh-noteb" aria-pressed={props.pressed} disabled={props.disabled} onClick={props.onToggle} style={props.layer === undefined ? undefined : { zIndex: props.layer }}>
      <Note value={props.card.value} />
      <i class="kh-notev" aria-hidden="true">{props.card.value}</i>
    </button>
  );
}

export function Backs(props: { count: number }) {
  return (
    <span class="kh-backs" aria-label={`${props.count} money cards`}>
      <img src={CARD_BACK} alt="" />×{props.count}
    </span>
  );
}

export function CardBack() {
  return <img class="kh-note sm" src={CARD_BACK} alt="face-down card" />;
}
