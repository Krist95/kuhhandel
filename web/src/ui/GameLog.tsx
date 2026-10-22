import { useEffect, useRef } from "preact/hooks";
import type { LogEntry } from "../../../src/rules/types";

export function GameLog(props: { log: LogEntry[]; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [props.log.length]);
  return (
    <div class="log-panel" role="log" aria-label="Game log">
      <div class="log-head"><strong>Log</strong><button class="small secondary" onClick={props.onClose}>Close</button></div>
      <div class="log-body" ref={box}>
        {props.log.map((e) => <div key={e.seq} class="log-line">{e.text}</div>)}
      </div>
    </div>
  );
}
