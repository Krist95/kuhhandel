import { useEffect, useState } from "preact/hooks";
import { secondsLeft } from "../../model/clock";
import { ringState } from "../../model/stage";
import { offset } from "../../state";

export function CountdownRing(props: { deadline: number | null; decisionSeconds: number; paused: boolean; size?: "md" | "lg"; idleLabel?: string }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);
  const lg = props.size === "lg" ? " lg" : "";
  if (props.deadline === null) {
    return <span class={`kh-ring idle${lg}`} style={{ "--p": 0 } as any}><span>{props.idleLabel}</span></span>;
  }
  const r = ringState(secondsLeft(props.deadline, Date.now(), offset.value), props.decisionSeconds, props.paused);
  const cls = `kh-ring${lg}${r.low && !props.paused ? " low" : ""}`;
  return <span class={cls} style={{ "--p": r.p } as any}><span>{r.label}</span></span>;
}
