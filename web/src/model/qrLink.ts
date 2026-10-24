const LINK_PATTERN = /\/join\/([A-Z0-9]{6})$/i;
const BARE_PATTERN = /^[A-Z0-9]{6}$/i;

export function extractRoomId(scanned: string): string | null {
  const link = LINK_PATTERN.exec(scanned.trim());
  if (link) return link[1]!.toUpperCase();
  const bare = scanned.trim().toUpperCase();
  return BARE_PATTERN.test(bare) ? bare : null;
}
