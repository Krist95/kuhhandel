const KEY = "kuhhandel.roomId";

export function loadRoomId(store: Pick<Storage, "getItem"> | null): string | null {
  try { return store?.getItem(KEY) ?? null; } catch { return null; }
}
export function saveRoomId(store: Pick<Storage, "setItem"> | null, roomId: string): void {
  try { store?.setItem(KEY, roomId); } catch { /* ignore */ }
}
export function clearRoomId(store: Pick<Storage, "removeItem"> | null): void {
  try { store?.removeItem(KEY); } catch { /* ignore */ }
}
