export { GameRoom } from "./room";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/ws") return env.ASSETS.fetch(request);
    if (request.method !== "GET" || request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected a WebSocket upgrade", { status: 426, headers: { Upgrade: "websocket" } });
    }
    // Each room gets its own Durable Object, named after the room code the client chose or already holds,
    // so separate games never share state. A caller with no code (e.g. a bare /ws request) gets the default room.
    const roomId = (url.searchParams.get("room") ?? "main").trim().slice(0, 20) || "main";
    return env.GAME_ROOM.get(env.GAME_ROOM.idFromName(roomId)).fetch(request);
  },
} satisfies ExportedHandler<Env>;
