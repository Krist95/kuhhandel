import { ANIMAL_NAME, ANIMAL_VALUE, type Animal } from "../../../../src/rules/types";
import { ANIMAL_ART } from "../../art";

const cvar = (animal: Animal) => ({ "--c": `var(--animal-${animal})` }) as any;
const name = (animal: Animal) => ANIMAL_NAME[animal][0];

export function AnimalTile(props: { animal: Animal; count?: number }) {
  const { animal, count } = props;
  const n = count ?? 0;
  if (count === undefined) {
    return <span class="kh-tile" style={cvar(animal)}><img src={ANIMAL_ART[animal]} alt="" /></span>;
  }
  return (
    <span class={`kh-tile${n === 4 ? " set" : ""}`} style={cvar(animal)} title={`${name(animal)} ×${n}`}>
      <img src={ANIMAL_ART[animal]} alt={name(animal)} /><i>{n}</i>
    </span>
  );
}

export function AnimalChip(props: { animal: Animal; count: number }) {
  const { animal, count } = props;
  return (
    <span class={`kh-chip${count === 4 ? " set" : ""}`} style={cvar(animal)}>
      <span class="art"><img src={ANIMAL_ART[animal]} alt="" /></span>
      <span class="txt"><b>{name(animal)}</b><span>{ANIMAL_VALUE[animal]}</span></span>
      <span class="cnt">{count === 4 ? "Set" : `×${count}`}</span>
    </span>
  );
}

export function LotCard(props: { animal: Animal }) {
  const { animal } = props;
  return (
    <div class="kh-lot" style={cvar(animal)}>
      <img src={ANIMAL_ART[animal]} alt="" />
      <div class="foot"><span>{name(animal)}</span><b>{ANIMAL_VALUE[animal]}</b></div>
    </div>
  );
}
