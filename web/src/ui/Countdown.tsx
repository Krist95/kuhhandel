import { useEffect, useState } from "preact/hooks";
import { secondsLeft } from "../model/clock";
import { offset } from "../state";

export function Countdown(props: { deadline: number | null; label: string | null }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);
  const s = secondsLeft(props.deadline, Date.now(), offset.value);
  if (s === null) return null;
  return <div class="countdown">{props.label ? `${props.label} · ` : ""}{s}s</div>;
}
