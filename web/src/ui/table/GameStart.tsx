import { useEffect, useRef, useState } from "preact/hooks";
import type { View } from "../../../../src/protocol";
import { intro } from "../../model/stage";
import { Note } from "./Money";

export function GameStart(props: { view: View; onDone: () => void }) {
  const [width, setWidth] = useState(100);
  const done = useRef(false);
  const finish = () => {
    if (done.current) return;
    done.current = true;
    props.onDone();
  };
  useEffect(() => {
    const raf = requestAnimationFrame(() => setWidth(0));
    const timer = setTimeout(finish, 3000);
    return () => { cancelAnimationFrame(raf); clearTimeout(timer); };
  }, []);
  const info = intro(props.view);
  if (!info) return null;
  const first = info.order.find((o) => o.first);
  const notes = [...(props.view.me?.money ?? [])].sort((a, b) => a.value - b.value);
  const total = notes.reduce((n, m) => n + m.value, 0);
  return (
    <div class="kh-veil" onPointerDown={finish}>
      <div class="kh-intro">
        <span class="kh-cap">Shuffled · 40 animals · 4 donkeys somewhere</span>
        <h2>{first?.me ? <><em>You</em> go first.</> : <><em>{first?.label}</em> goes first.</>}</h2>
        <p>Picked at random. Complaints go to the random number generator.</p>
        <div class="kh-order">
          {info.order.flatMap((o, i) => {
            const cls = [o.first && "first", o.me && "me"].filter(Boolean).join(" ");
            const pill = <span key={o.id} class={cls || undefined}>{o.label}</span>;
            return i === 0 ? [pill] : [<i key={`${o.id}-a`}>→</i>, pill];
          })}
        </div>
        <span class="kh-cap">Your money</span>
        <div class="kh-deal">
          {notes.map((m) => <Note key={m.id} value={m.value} size="sm" />)}
          <b>{total}</b>
        </div>
        <div class="kh-bar"><i style={{ width: `${width}%`, transition: "width 3000ms linear" }} /></div>
      </div>
    </div>
  );
}
