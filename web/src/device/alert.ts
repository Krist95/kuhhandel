type Ctor = typeof AudioContext;
let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  try {
    if (ctx) return ctx;
    const C: Ctor | undefined = typeof AudioContext !== "undefined" ? AudioContext
      : (globalThis as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    return ctx;
  } catch { return null; }
}

export function unlockAudio(): void {
  try {
    const c = context();
    if (c && c.state === "suspended") void c.resume().catch(() => {});
  } catch { /* optional */ }
}

export function playTurnAlert(): void {
  try { navigator.vibrate?.(120); } catch { /* optional */ }
  try {
    const c = context();
    if (!c) return;
    if (c.state === "suspended") void c.resume().catch(() => {});
    const osc = c.createOscillator();
    const gain = c.createGain();
    const t = c.currentTime;
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.15);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.15);
  } catch { /* optional */ }
}
