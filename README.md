# Kuhhandel Online

An online version of the card game Kuhhandel (Cow Trading) for 3 to 5 players. It is played on phones in landscape and installs as a PWA. There is one room per deployment. It runs on Cloudflare Workers Free with a single Durable Object (`GameRoom`, bound as `GAME_ROOM`) that serves the game and the static client from `web/dist`.

The code has three parts: a pure TypeScript rules engine, the Worker plus Durable Object, and a Vite + Preact client.

## Install

```
npm install
```

Use `npm ci` for a reproducible install from the lockfile.

## Development

Run these in two terminals:

```
npm run dev:server
npm run dev:web
```

Vite proxies `/ws` to `wrangler dev` on localhost:8787.

Open http://localhost:5173. Phones on the same Wi-Fi can open `http://<pc-ip>:5173`, but wake lock and PWA install need HTTPS.

## Tests and checks

- `npm test` runs the engine, protocol and client model tests in Node.
- `npm run test:server` runs the Worker and Durable Object tests in workerd.
- `npm run typecheck` generates Worker types and runs `tsc` for the engine, Worker and web projects.
- `npm run build` builds the client into `web/dist`.
- `npm run icons` regenerates the PNG icons from `web/src/art/icon.svg`.

## Deploy

Log in to Cloudflare once, then deploy:

```
npx wrangler login
npm run deploy
```

`npm run deploy` builds the client and then runs `wrangler deploy`. The output should list the `GAME_ROOM` Durable Object binding and a `https://kuhhandel.<subdomain>.workers.dev` URL.

### First-deploy checks

- The deploy output lists the `GAME_ROOM` binding and, on the first deploy, applies the `v1` Durable Object migration.
- Create and join a room right after deploying. This confirms that PBKDF2 at 100,000 iterations fits the Free plan CPU limit.

### Optional auto-deploy

Connect the GitHub repository in Cloudflare Workers Builds with build command `npm run build` and deploy command `npx wrangler deploy`.

## Playtest checklist

Try on 3 or more real phones, covering what automated tests can't:

- Install as a PWA: fullscreen landscape on Android, no browser bars on iPhone. The rotate overlay shows in portrait. The screen stays awake during play. You get vibration and a beep on your turn.
- Reload during your own decision: the seat and countdown come back. A second tab replaces the first.
- Put the host in flight mode for 2 min, also while paused: host passes clockwise.
- The bluff overlay lasts 5 s for everyone. The trade reveal shows only on the two phones involved.
- A player goes Away after 3 timeouts; "I'm back" clears it.
- The room closes 5 min after the end screen, and Play again cancels that.
- At 740×360, check that these fit without scrolling: the lobby's host side column, the Offer and Pay money sheets with a large hand, and the rules and log panels.
- Opponent panels wrap their animal chips cleanly when a player holds many animals.
- Animal frame colours look right, and a complete set gets the gold outline.
- Reconnect after closing a tab (close handshake) and after switching between Wi-Fi and cellular. The "Reconnecting…" badge appears and then clears.
- On iPhone, install the PWA before joining a game. The home-screen app has separate storage, so it gets a new token and seat.
