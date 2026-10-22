import type { Animal } from "../../../src/rules/types";
import { ANIMAL_NAME, ANIMAL_VALUE } from "../../../src/rules/types";
import { ANIMAL_COLOR } from "../art";

export function AnimalCard(props: { animal: Animal; count?: number; size: "chip" | "card"; complete?: boolean }) {
  const { animal, count, size } = props;
  const [singular] = ANIMAL_NAME[animal]; // [singular, plural] tuple
  const complete = props.complete ?? count === 4;
  return (
    <div class={`animal ${size}${complete ? " complete" : ""}`} style={{ borderColor: ANIMAL_COLOR[animal], background: ANIMAL_COLOR[animal] }}>
      <span class="a-name">{singular}</span>
      <span class="a-value">{ANIMAL_VALUE[animal]}</span>
      {count !== undefined && <span class="a-count">×{count}</span>}
    </div>
  );
}
