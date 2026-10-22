export { GameRoom } from "./room";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname !== "/ws") return env.ASSETS.fetch(request);
    if (request.method !== "GET" || request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected a WebSocket upgrade", { status: 426, headers: { Upgrade: "websocket" } });
    }
    return env.GAME_ROOM.get(env.GAME_ROOM.idFromName("main")).fetch(request);
  },
} satisfies ExportedHandler<Env>;
