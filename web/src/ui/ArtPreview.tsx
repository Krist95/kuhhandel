import { ANIMALS, type MoneyValue } from "../../../src/rules/types";
import { ANIMAL_ART, ANIMAL_COLOR, CARD_BACK } from "../art";
import { AnimalCard } from "./AnimalCard";
import { MoneyNote } from "./MoneyNote";

const VALUES: MoneyValue[] = [0, 10, 50, 100, 200, 500];
const page = { height: "100%", overflowY: "auto", padding: "0.8em", boxSizing: "border-box" } as const;
const row = { display: "flex", flexWrap: "wrap", gap: "0.6em", alignItems: "center", margin: "0.3em 0 0.9em" } as const;

// Dev-only review page (?art): every card and note at chip and full size, plus the bare portraits at 32 px.
export function ArtPreview() {
  return (
    <div style={page}>
      <h2>Animals · chip</h2>
      <div style={row}>{ANIMALS.map((a) => <AnimalCard key={a} animal={a} count={2} size="chip" />)}</div>
      <h2>Animals · 32 px</h2>
      <div style={row}>
        {ANIMALS.map((a) => <img key={a} src={ANIMAL_ART[a]} width={32} height={32} alt={a} style={{ background: ANIMAL_COLOR[a], borderRadius: 4 }} />)}
      </div>
      <h2>Animals · card</h2>
      <div style={row}>{ANIMALS.map((a) => <AnimalCard key={a} animal={a} count={4} size="card" />)}</div>
      <h2>Money · chip</h2>
      <div style={row}>
        {VALUES.map((v) => <MoneyNote key={v} value={v} size="chip" />)}
        <img class="money-note chip" src={CARD_BACK} alt="Card back" />
      </div>
      <h2>Money · card</h2>
      <div style={row}>
        {VALUES.map((v) => <MoneyNote key={v} value={v} size="card" />)}
        <img class="money-note card" src={CARD_BACK} alt="Card back" />
      </div>
    </div>
  );
}
