export function clockOffset(serverTime: number, localNow: number): number {
  return serverTime - localNow;
}
export function secondsLeft(deadline: number | null, localNow: number, offset: number): number | null {
  if (deadline === null) return null;
  return Math.max(0, Math.ceil((deadline - (localNow + offset)) / 1000));
}
