let wanted = false;
let sentinel: WakeLockSentinel | null = null;
let pending = false;
let listening = false;

async function acquire(): Promise<void> {
  if (!wanted || sentinel || pending) return;
  try {
    if (!navigator.wakeLock) return;
    pending = true;
    const s = await navigator.wakeLock.request("screen");
    pending = false;
    if (!wanted || sentinel) { void s.release().catch(() => {}); return; }
    sentinel = s;
    s.addEventListener("release", () => { if (sentinel === s) sentinel = null; });
  } catch { pending = false; }
}

function onVisible(): void {
  if (document.visibilityState === "visible") void acquire();
}

export function keepAwake(on: boolean): void {
  try {
    wanted = on;
    if (on) {
      if (!listening) { document.addEventListener("visibilitychange", onVisible); listening = true; }
      void acquire();
    } else {
      if (listening) { document.removeEventListener("visibilitychange", onVisible); listening = false; }
      const s = sentinel;
      sentinel = null;
      if (s) void s.release().catch(() => {});
    }
  } catch { /* optional */ }
}
