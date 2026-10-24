const JOIN_PATH_PATTERN = /^\/join\/([A-Z0-9]{6})$/i;

export type StartupDecision = {
  /** The room id to connect to on load, or null if there is nothing to connect to. */
  roomId: string | null;
  /** True if a stale or fresh `/join/...` URL should be replaced with `/` so it can't win a future reload. */
  clearUrl: boolean;
};

/**
 * Decides which room id wins at startup — a fresh `/join/<id>` link in the URL, or a previously
 * saved room id from storage — and whether the URL needs clearing afterward.
 *
 * A `/join/...` URL is single-use: whether it matches the 6-character pattern (a fresh invite link)
 * or not (a stale/malformed one left over from a previous visit), it must never be able to re-win a
 * later reload over a more recent saved session. So any `/join/...` path gets cleared here.
 */
export function decideStartup(pathname: string, savedRoomId: string | null): StartupDecision {
  const match = JOIN_PATH_PATTERN.exec(pathname);
  const roomId = match ? match[1]!.toUpperCase() : savedRoomId;
  const clearUrl = pathname.startsWith("/join/");
  return { roomId, clearUrl };
}
