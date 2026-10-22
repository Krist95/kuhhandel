import { useEffect } from "preact/hooks";
import { toast } from "../state";

export function Toast() {
  const msg = toast.value;
  useEffect(() => {
    if (msg === null) return;
    const t = setTimeout(() => { if (toast.value === msg) toast.value = null; }, 3000);
    return () => clearTimeout(t);
  }, [msg]);
  return msg === null ? null : <div class="toast" role="status" onClick={() => { toast.value = null; }}>{msg}</div>;
}
