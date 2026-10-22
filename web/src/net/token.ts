const KEY = "kuhhandel.token";

export function uuidV4(fill: (b: Uint8Array) => Uint8Array = (b) => crypto.getRandomValues(b)): string {
  const b = fill(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function loadToken(store: Pick<Storage, "getItem" | "setItem"> | null): string {
  try {
    const saved = store?.getItem(KEY);
    if (saved) return saved;
  } catch { /* blocked storage: fall through */ }
  const fresh = uuidV4();
  try { store?.setItem(KEY, fresh); } catch { /* ignore */ }
  return fresh;
}
