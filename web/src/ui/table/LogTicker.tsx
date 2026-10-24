import type { LogEntry } from "../../../../src/rules/types";

export function LogTicker(props: { log: readonly LogEntry[]; onOpen: () => void }) {
  const now = props.log[props.log.length - 1];
  const prev = props.log.length > 1 ? props.log[props.log.length - 2] : undefined;
  return (
    <button class="kh-ticker" onClick={props.onOpen}>
      <span class="kh-cap">Log</span>
      <span class="t">{now?.text}{prev && <>{" "}<span class="prev">· {prev.text}</span></>}</span>
      <span class="more">▾</span>
    </button>
  );
}
