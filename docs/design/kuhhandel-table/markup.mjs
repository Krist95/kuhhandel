// Reference markup for every component in the Kuhhandel Table design. Run: node docs/design/kuhhandel-table/markup.mjs <outdir>
// /_blob/<id> URLs are the design artifact's copies of web/src/art/*.svg (map in B / NOTE / BACK below).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const OUT = process.argv[2];
const B = {
  rooster: "07b7058bb702e5c074c833db4bee9773", goose: "d587950a5611ccf3f237ccafd2c9ab5c", cat: "d41338c581321aff2656a0fbb6d8e4b8",
  dog: "4d4b2f18f25cbd3d12440514a0a9bed7", sheep: "c66002dc16bbe98caa463fbda986e24b", goat: "654f3ee97620602b4b01b9d5d0ff9d38",
  donkey: "f18609d077660d878de967ff9bc185f1", pig: "87f02f8add2a2e8653a0fe762fe1a157", cow: "6d36bccb39a90b63bc6b017275381d4b",
  horse: "29847a268b68ece6c33ba4fd1f5945bd",
};
const NOTE = { 0: "337ae7209266225c6985499b826faa90", 10: "8426ef5f105c5a64912e43e47c72ab50", 50: "68d328feb200b56130b08acd855848ea",
  100: "959f6d66243b9400366b75f63cf70ac2", 200: "466f0b775636059f7e6138af23b7ad51", 500: "2b60a42766cfde1245879529982fdc66" };
const BACK = "/_blob/0e5ce920a5235d8815d2cc72a21e9942";
const VALUE = { rooster: 10, goose: 40, cat: 90, dog: 160, sheep: 250, goat: 350, donkey: 500, pig: 650, cow: 800, horse: 1000 };
const cap = (a) => a[0].toUpperCase() + a.slice(1);
const art = (a) => `/_blob/${B[a]}`;
const c = (a) => `--c:var(--animal-${a})`;

const tile = (a, n) => `<span class="kh-tile${n === 4 ? " set" : ""}" style="${c(a)}" title="${cap(a)} ×${n}"><img src="${art(a)}" alt="${cap(a)}"><i>${n}</i></span>`;
const chip = (a, n) => `<span class="kh-chip${n === 4 ? " set" : ""}" style="${c(a)}"><span class="art"><img src="${art(a)}" alt=""></span><span class="txt"><b>${cap(a)}</b><span>${VALUE[a]}</span></span><span class="cnt">${n === 4 ? "Set" : "×" + n}</span></span>`;
const lot = (a) => `<div class="kh-lot" style="${c(a)}"><img src="${art(a)}" alt=""><div class="foot"><span>${cap(a)}</span><b>${VALUE[a]}</b></div></div>`;
const note = (v, cls = "") => `<img class="kh-note ${cls}" src="/_blob/${NOTE[v]}" alt="${v}">`;
const back = (cls = "sm") => `<img class="kh-note ${cls}" src="${BACK}" alt="face-down card">`;
const backs = (n) => `<span class="kh-backs" aria-label="${n} money cards"><img src="${BACK}" alt="">×${n}</span>`;
const ring = (txt, p = 1, cls = "") => `<span class="kh-ring ${cls}" style="--p:${p}"><span>${txt}</span></span>`;

const ORDER = ["rooster", "goose", "cat", "dog", "sheep", "goat", "donkey", "pig", "cow", "horse"];
// Fixed 10-column herd ledger: column = animal (value order), pips = count, gold ring = set.
function ledger(herd) {
  const has = Object.fromEntries(herd);
  return `<span class="kh-ledger" aria-label="${herd.map(([a, n]) => `${cap(a)} ${n}`).join(", ") || "No animals"}">${ORDER.map((a) => {
    const n = has[a] ?? 0;
    return `<span class="${n === 0 ? "none" : n === 4 ? "set" : ""}" style="${c(a)}">${[0, 1, 2, 3].map((i) => `<i class="${i < n ? "on" : ""}"></i>`).join("")}</span>`;
  }).join("")}</span>`;
}

function pod({ name, herd = [], money = 7, active, secs, p = 0.6, pills = [], dim, out }) {
  const cls = ["kh-pod", active && "active", dim && "dim", out && "out"].filter(Boolean).join(" ");
  const r = active ? ring(secs, p, secs <= 5 ? "low" : "") : ring(name[0], 0, "idle");
  const badge = pills.length ? `<span class="kh-pill ${pills[0].toLowerCase()}">${pills[0] === "Off" ? "Offline" : pills[0]}</span>` : "";
  const herdHtml = out ? "<em>Out · watching</em>" : ledger(herd);
  return `<button class="${cls}"><span class="av">${r}${badge}</span><span class="meta"><span class="top"><span class="nm">${name}</span>${backs(money)}</span><span class="herd">${herdHtml}</span></span></button>`;
}

// Herd board: everyone's animals side by side, plus what's left in the deck.
function herdBoard({ players, meName, focus, trade = {}, secs, p, title = "Herds" }) {
  const held = Object.fromEntries(ORDER.map((a) => [a, 0]));
  players.forEach((pl) => pl.herd.forEach(([a, n]) => (held[a] += n)));
  const mine = Object.fromEntries(players.find((x) => x.name === meName)?.herd ?? []);
  const cell = (a, n, row) => {
    if (n === 0) return `<span class="cell zero">·</span>`;
    const t = row !== meName && (trade[row] ?? []).includes(a);
    return `<span class="cell${n === 4 ? " set" : ""}${t ? " trade" : ""}" style="${c(a)}"><b>${n === 4 ? "Set" : n}</b><span class="pips">${[0, 1, 2, 3].map((i) => `<i class="${i < n ? "on" : ""}"></i>`).join("")}</span></span>`;
  };
  const head = `<span class="corner"></span>${ORDER.map((a) => `<span class="colh"><span class="kh-tile" style="${c(a)}"><img src="${art(a)}" alt=""></span><span>${VALUE[a]}</span></span>`).join("")}`;
  const rows = players.map((pl) => {
    const h = Object.fromEntries(pl.herd);
    const sets = pl.herd.filter(([, n]) => n === 4).length;
    return `<span class="rowh${pl.name === meName ? " me" : ""}${pl.name === focus ? " focus" : ""}"><b>${pl.name === meName ? "You" : pl.name}</b><span>${sets ? `${sets} set${sets > 1 ? "s" : ""} · ` : ""}${pl.money} cards</span></span>${ORDER.map((a) => cell(a, h[a] ?? 0, pl.name)).join("")}`;
  }).join("");
  const deck = `<span class="rowh deck"><b>In deck</b><span>${ORDER.reduce((n, a) => n + 4 - held[a], 0)} cards</span></span>${ORDER.map((a) => `<span class="cell left">${4 - held[a] || "—"}</span>`).join("")}`;
  return `<div class="kh-board" role="dialog" aria-label="Herds"><div class="bhead">${secs !== undefined ? ring(secs, p, secs <= 5 ? "low" : "") : ""}<span class="h">${title}</span><span class="kh-hint">Dashed gold = you can cow-trade it. Sets are locked.</span><button class="kh-btn secondary close">Close</button></div><div class="grid">${head}${rows}${deck}</div></div>`;
}

const donkeys = (on, nextIdx) => `<div class="kh-donkeys" title="Donkeys revealed">${[0, 1, 2, 3].map((i) => `<i class="${i < on ? "on" : i === nextIdx ? "next" : ""}"></i>`).join("")}</div>`;
const pile = (deck, don) => `<div class="kh-pile"><div class="kh-deck"><span></span><span></span><span></span><b>${deck}</b></div><span class="kh-cap">Deck</span>${donkeys(don, don)}<span class="kh-cap">${don < 4 ? "Next +" + [50, 100, 200, 500][don] : "All paid"}</span></div>`;

function hand({ herd, money, picked = [], picking, owed, label }) {
  const sel = money.filter((_, i) => picked.includes(i)).reduce((n, v) => n + v, 0);
  const total = money.reduce((n, v) => n + v, 0);
  const notes = money.map((v, i) => `<button class="kh-noteb" aria-pressed="${picked.includes(i)}" ${picking ? "" : "disabled"}>${note(v)}</button>`).join("");
  const sum = picking
    ? `<span class="sum"><span class="kh-cap">${label ?? "Selected"}</span><b class="sel">${sel}${owed ? `<span style="color:var(--muted);font-weight:600;font-size:13px"> / ${owed}</span>` : ""}</b></span>`
    : `<span class="sum"><span class="kh-cap">Cash</span><b>${total}</b></span>`;
  return `<div class="kh-hand${picking ? " picking" : ""}"><div class="herdrow${herd.length > 4 ? " tiles" : ""}">${herd.length ? herd.map(([a, n]) => (herd.length > 4 ? tile(a, n) : chip(a, n))).join("") : `<span class="kh-hint">Your animals land here.</span>`}</div><div class="money">${notes}${sum}</div></div>`;
}

const ticker = (now, prev) => `<button class="kh-ticker"><span class="kh-cap">Log</span><span class="t">${now}${prev ? ` <span class="prev">· ${prev}</span>` : ""}</span><span class="more">▾</span></button>`;

// ---- dock states ----
const dock = {
  watch: (who, what, secs, p) => `<div class="kh-dock"><div class="head">${ring(secs, p, secs <= 5 ? "low" : "")}<div><div class="h">${who}’s move</div><div class="s">${what}</div></div></div><div class="push"><div class="kh-hint">Nothing for you to do. Look busy.</div></div></div>`,
  turn: (deck, secs, p, tradeOk = true) => `<div class="kh-dock mine"><div class="head">${ring(secs, p, "lg" + (secs <= 5 ? " low" : ""))}<div><div class="h">Your turn</div><div class="s">Timeout = auction</div></div></div><div class="push"><button class="kh-btn big">Auction<small>Flip the top card · ${deck} left</small></button><button class="kh-btn big secondary" ${tradeOk ? "" : "disabled"}>Cow trade<small>${tradeOk ? "Challenge someone for an animal" : "No cow trade possible"}</small></button></div></div>`,
  bid: (amount, top, topName, secs, p) => `<div class="kh-dock mine"><div class="head">${ring(secs, p, secs <= 5 ? "low" : "")}<div><div class="h">Your bid</div><div class="s">Top: ${top} · ${topName}</div></div></div><div class="push"><div class="kh-stepper"><button aria-label="Lower">−</button><output>${amount}</output><button aria-label="Raise">+</button></div><div class="kh-three"><button class="kh-btn quick">+10</button><button class="kh-btn quick">+50</button><button class="kh-btn quick">+100</button></div><div class="kh-two"><button class="kh-btn secondary">Pass</button><button class="kh-btn">Bid ${amount}</button></div></div></div>`,
  decide: (bid, name, buy, secs, p) => `<div class="kh-dock mine"><div class="head">${ring(secs, p, secs <= 5 ? "low" : "")}<div><div class="h">${name} bid ${bid}</div><div class="s">Timeout = sell</div></div></div><div class="push"><button class="kh-btn big">Sell<small>${name} pays you ${bid}</small></button><button class="kh-btn big secondary" ${buy ? "" : "disabled"}>Buy it<small>${buy ? `You pay ${name} ${bid}` : "You can’t cover " + bid}</small></button></div></div>`,
  pay: (owed, to, sel, secs, p) => `<div class="kh-dock mine"><div class="head">${ring(secs, p, secs <= 5 ? "low" : "")}<div><div class="h">Pay ${owed} to ${to}</div><div class="s">Tap notes in your hand</div></div></div><div class="push"><div class="kh-meter${sel >= owed ? " done" : ""}" style="--m:${Math.min(1, sel / owed)}"><i></i></div><div class="kh-hint">${sel >= owed ? (sel > owed ? `${sel - owed} over — no change given.` : "Exact.") : `${owed - sel} still to go.`}</div><div class="kh-two"><button class="kh-btn secondary">Best fit</button><button class="kh-btn" ${sel >= owed ? "" : "disabled"}>Pay ${sel}</button></div></div></div>`,
  setup: (opts, chosen, count, cards, secs, p) => `<div class="kh-dock mine"><div class="head">${ring(secs, p, secs <= 5 ? "low" : "")}<div><div class="h">Cow trade</div><div class="s">Pick a rival and an animal</div></div></div><div class="kh-col" style="gap:5px">${opts.map(([who, a, max], i) => `<div class="kh-opt" aria-pressed="${i === chosen}">${tile(a, 1).replace(/<i>1<\/i>/, "")}<span class="nm">${who} · ${cap(a)}</span><span class="kh-seg"><button aria-pressed="${i === chosen && count === 1}">×1</button><button aria-pressed="${i === chosen && count === 2}" ${max < 2 ? "disabled" : ""}>×2</button></span></div>`).join("")}</div><div class="push"><div class="kh-hint">Then pick face-down notes in your hand. Zeros welcome.</div><div class="kh-two"><button class="kh-btn secondary">Cancel</button><button class="kh-btn" ${cards ? "" : "disabled"}>Offer ${cards}</button></div></div></div>`,
  respond: (who, n, a, cards, sel, secs, p) => `<div class="kh-dock mine"><div class="head">${ring(secs, p, secs <= 5 ? "low" : "")}<div><div class="h">${who} wants your ${n === 1 ? cap(a) : n + " " + cap(a) + "s"}</div><div class="s">They put down ${cards} cards</div></div></div><div class="push"><div class="kh-hint">Counter with notes from your hand, or fold and pocket their ${cards} cards.</div><div class="kh-two"><button class="kh-btn secondary">Put nothing</button><button class="kh-btn" ${sel ? "" : "disabled"}>Counter ${sel}</button></div></div></div>`,
};

// ---- scenario data ----
const LATE = [
  { name: "You", herd: [["horse", 2], ["sheep", 1], ["donkey", 1], ["goat", 1]], money: 6 },
  { name: "Anna", herd: [["goose", 2], ["pig", 1], ["cat", 1], ["dog", 3], ["sheep", 1], ["goat", 2]], money: 4 },
  { name: "Ben", herd: [["cat", 1], ["horse", 1], ["cow", 2], ["donkey", 1], ["goose", 1]], money: 9 },
  { name: "Clara", herd: [["rooster", 4], ["cow", 1], ["sheep", 2], ["goose", 1]], money: 5 },
  { name: "Dan", herd: [["dog", 1], ["goat", 1], ["donkey", 2]], money: 8 },
];
const LATE_TRADE = { Anna: ["sheep", "goat"], Ben: ["horse", "donkey"], Clara: ["sheep"], Dan: ["goat", "donkey"] };
const OPP = {
  start: [
    { name: "Anna", herd: [], money: 7 }, { name: "Ben", herd: [], money: 7, pills: ["Host"] },
    { name: "Clara", herd: [], money: 7 }, { name: "Dan", herd: [], money: 7 },
  ],
};

function table({ rail, tick, stage, handHtml, dockHtml, extra = "" }) {
  return `<div class="kh kh-table">
  <div class="rail">${rail.join("")}<button class="menu" aria-label="Menu">⋯</button></div>
  ${tick}
  <div class="kh-stage">${stage}</div>
  ${handHtml}
  ${dockHtml}
  ${extra}
</div>`;
}

const scenes = {};
scenes.start = table({
  rail: [pod({ ...OPP.start[0] }), pod({ ...OPP.start[1] }), pod({ ...OPP.start[2] }), pod({ ...OPP.start[3] })],
  tick: ticker("The deck is shuffled. You go first."),
  stage: `${pile(40, 0)}<div class="kh-info"><span class="kh-cap">Round 1</span><div class="kh-banner">You open. <span>Flip a card or… no, flip a card.</span></div><div class="kh-hint" style="color:var(--paper);opacity:.8">Nobody owns an animal yet, so a cow trade isn’t possible.</div></div>`,
  handHtml: hand({ herd: [], money: [0, 0, 10, 10, 10, 10, 50] }),
  dockHtml: dock.turn(40, 17, 0.85, false),
});
scenes.bidding = table({
  rail: [
    pod({ name: "Anna", herd: [["goose", 2], ["pig", 1]], money: 6, active: true, secs: 12, p: 0.6 }),
    pod({ name: "Ben", herd: [["cat", 1], ["horse", 1]], money: 9, pills: ["Host"], dim: true }),
    pod({ name: "Clara", herd: [["rooster", 4], ["cow", 1]], money: 5 }),
    pod({ name: "Dan", herd: [["dog", 2]], money: 8, pills: ["Away"] }),
  ],
  tick: ticker("Clara bid 120", "Ben passed"),
  stage: `${pile(27, 1)}${lot("horse")}<div class="kh-info"><span class="kh-cap">Auction · Your lot</span><div class="kh-big">120<small>Clara</small></div><div class="kh-bidders"><span class="kh-bidder now">Anna</span><span class="kh-bidder passed">Ben</span><span class="kh-bidder top">Clara <b>120</b></span><span class="kh-bidder">Dan</span></div></div>`,
  handHtml: hand({ herd: [["horse", 2], ["sheep", 1], ["goose", 1]], money: [0, 10, 10, 50, 100, 200] }),
  dockHtml: dock.watch("Anna", "Bidding on your Horse", 12, 0.6),
});
scenes.mybid = table({
  rail: [
    pod({ name: "Anna", herd: [["goose", 2], ["pig", 1]], money: 6 }),
    pod({ name: "Ben", herd: [["cat", 1], ["horse", 1]], money: 9, pills: ["Host"] }),
    pod({ name: "Clara", herd: [["rooster", 4], ["cow", 1]], money: 5, dim: true }),
    pod({ name: "Dan", herd: [["dog", 2]], money: 8, pills: ["Off"] }),
  ],
  tick: ticker("Donkey! Everyone receives 100", "Ben is auctioning"),
  stage: `${pile(19, 2)}${lot("donkey")}<div class="kh-info"><span class="kh-cap">Auction · Ben’s lot</span><div class="kh-big">90<small>Anna</small></div><div class="kh-bidders"><span class="kh-bidder now">You</span><span class="kh-bidder passed">Clara</span><span class="kh-bidder">Dan</span><span class="kh-bidder top">Anna <b>90</b></span></div></div>`,
  handHtml: hand({ herd: [["horse", 2], ["sheep", 1], ["donkey", 1]], money: [0, 10, 50, 100, 100, 200] }),
  dockHtml: dock.bid(100, 90, "Anna", 14, 0.7),
});
scenes.pay = table({
  rail: [
    pod({ name: "Anna", herd: [["goose", 2], ["pig", 1]], money: 6 }),
    pod({ name: "Ben", herd: [["cat", 1], ["horse", 1]], money: 9, pills: ["Host"] }),
    pod({ name: "Clara", herd: [["rooster", 4], ["cow", 1]], money: 5 }),
    pod({ name: "Dan", herd: [["dog", 2]], money: 8 }),
  ],
  tick: ticker("Ben sold you the Pig for 160"),
  stage: `${pile(18, 2)}${lot("pig")}<div class="kh-info"><span class="kh-cap">Payment</span><div class="kh-big">160<small>you → Ben</small></div><div class="kh-hint" style="color:var(--paper);opacity:.85">Everyone sees the amount and how many notes. Only you and Ben see which.</div></div>`,
  handHtml: hand({ herd: [["horse", 2], ["sheep", 1], ["donkey", 1]], money: [0, 10, 50, 100, 100, 200], picked: [2, 3, 1], picking: true, owed: 160 }),
  dockHtml: dock.pay(160, "Ben", 160, 9, 0.45),
});
scenes.setup = table({
  rail: [
    pod({ name: "Anna", herd: [["goose", 2], ["pig", 1]], money: 6 }),
    pod({ name: "Ben", herd: [["cat", 1], ["horse", 1]], money: 9, pills: ["Host"] }),
    pod({ name: "Clara", herd: [["rooster", 4], ["cow", 1], ["sheep", 2]], money: 5 }),
    pod({ name: "Dan", herd: [["dog", 2]], money: 8 }),
  ],
  tick: ticker("You chose a cow trade"),
  stage: `${pile(0, 4)}<div class="kh-info"><span class="kh-cap">Cow trade · setting up</span><div class="kh-banner">You vs <span>…pick someone on the right.</span></div><div class="kh-hint" style="color:var(--paper);opacity:.85">Only rivals who share an animal with you are listed. Complete sets are off the table.</div></div>`,
  handHtml: hand({ herd: [["horse", 2], ["sheep", 2], ["pig", 1]], money: [0, 0, 10, 50, 100, 200], picked: [0, 3], picking: true, label: "Offer · 2 cards" }),
  dockHtml: dock.setup([["Ben", "horse", 1], ["Clara", "sheep", 2], ["Anna", "pig", 1]], 1, 2, 2, 15, 0.75),
});
scenes.respond = table({
  rail: [
    pod({ name: "Anna", herd: [["goose", 2], ["pig", 2]], money: 3, active: false }),
    pod({ name: "Ben", herd: [["cat", 1], ["horse", 1]], money: 9, pills: ["Host"] }),
    pod({ name: "Clara", herd: [["rooster", 4], ["cow", 1]], money: 5 }),
    pod({ name: "Dan", herd: [["dog", 2]], money: 8 }),
  ],
  tick: ticker("Anna challenged you for 2 Pigs"),
  stage: `${pile(0, 4)}<div class="kh-info"><span class="kh-cap">Cow trade · 2 Pigs</span><div class="kh-offer"><div class="side"><span class="kh-cap">Anna</span><div class="notes">${back()}${back()}${back()}</div></div><span class="vs">vs</span><div class="side"><span class="kh-cap">You</span><div class="notes"><span class="kh-hint" style="color:var(--paper);opacity:.7">deciding…</span></div></div></div><div class="kh-hint" style="color:var(--paper);opacity:.85">Values stay hidden. Only the two of you see them after.</div></div>`,
  handHtml: hand({ herd: [["horse", 2], ["sheep", 1], ["pig", 2]], money: [0, 10, 50, 100, 100, 200], picked: [3, 4], picking: true, label: "Counter · 2 cards" }),
  dockHtml: dock.respond("Anna", 2, "pig", 3, 200, 11, 0.55),
});
const intro = `<div class="kh-veil"><div class="kh-intro"><span class="kh-cap">Shuffled · 40 animals · 4 donkeys somewhere</span><h2><em>Clara</em> goes first.</h2><p>Picked at random. Complaints go to the random number generator.</p><div class="kh-order"><span class="first">Clara</span><i>→</i><span>Dan</span><i>→</i><span class="me">You</span><i>→</i><span>Anna</span><i>→</i><span>Ben</span></div><span class="kh-cap">Your money</span><div class="kh-deal">${[0, 0, 10, 10, 10, 10, 50].map((v) => note(v, "sm")).join("")}<b>90</b></div><div class="kh-bar"><i></i></div></div></div>`;
scenes.intro = table({
  rail: [pod({ ...OPP.start[0] }), pod({ ...OPP.start[1] }), pod({ name: "Clara", money: 7, active: true, secs: 20, p: 1 }), pod({ ...OPP.start[3] })],
  tick: ticker("Game started"),
  stage: `${pile(40, 0)}<div class="kh-info"><span class="kh-cap">Round 1</span><div class="kh-banner">Clara opens.</div></div>`,
  handHtml: hand({ herd: [], money: [0, 0, 10, 10, 10, 10, 50] }),
  dockHtml: dock.watch("Clara", "Choosing an action", 20, 1),
  extra: intro,
});

scenes.late = table({
  rail: [pod({ ...LATE[1], active: true, secs: 9, p: 0.45 }), pod({ ...LATE[2], pills: ["Host"] }), pod({ ...LATE[3] }), pod({ ...LATE[4], pills: ["Away"] })],
  tick: ticker("Anna is choosing an action", "Dan bought the Donkey for 230"),
  stage: `${pile(7, 4)}<div class="kh-info"><span class="kh-cap">Late game · 7 cards left</span><div class="kh-banner">Anna’s turn. <span>Six animal types and counting.</span></div><div class="kh-hint" style="color:var(--paper);opacity:.85">Tap any pod to compare every herd.</div></div>`,
  handHtml: hand({ herd: LATE[0].herd, money: [0, 10, 50, 100, 100, 200] }),
  dockHtml: dock.watch("Anna", "Choosing an action", 9, 0.45),
});
scenes.board = table({
  rail: [pod({ ...LATE[1], active: true, secs: 9, p: 0.45 }), pod({ ...LATE[2], pills: ["Host"] }), pod({ ...LATE[3] }), pod({ ...LATE[4], pills: ["Away"] })],
  tick: ticker("Anna is choosing an action"),
  stage: "",
  handHtml: hand({ herd: LATE[0].herd, money: [0, 10, 50, 100, 100, 200] }),
  dockHtml: dock.watch("Anna", "Choosing an action", 9, 0.45),
  extra: herdBoard({ players: LATE, meName: "You", focus: "Anna", trade: LATE_TRADE }),
});

// ---- files ----
const files = {};
const doc = (marker, body, script = "") => `${marker}\n<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:var(--felt-dark)}</style></head><body>${body}${script}</body></html>\n`;
const frame = (title, html) => `<figure style="margin:0 0 14px"><figcaption class="kh kh-cap" style="padding:0 0 6px 2px">${title}</figcaption>${html}</figure>`;

files["components/TableLayout/preview.html"] = doc(`<!-- @dsCard group="Screens" page height=3260 width=812 subtitle="The proposed in-game table, nine moments" -->`,
  `<div class="kh" style="padding:16px">${frame("1 · Game start — first player is picked, money dealt", scenes.intro)}${frame("2 · Your first turn", scenes.start)}${frame("3 · Watching someone bid on your lot", scenes.bidding)}${frame("4 · Your bid turn", scenes.mybid)}${frame("5 · Paying — pick notes right in your hand", scenes.pay)}${frame("6 · Cow trade setup, all in the dock", scenes.setup)}${frame("7 · Defending a cow trade", scenes.respond)}${frame("8 · Late game — pods with 3 to 6 animal types", scenes.late)}${frame("9 · Herd board — tap any pod", scenes.board)}</div>`);

files["components/GameStart/preview.html"] = doc(`<!-- @dsCard group="Screens" height=392 width=812 subtitle="3-second intro when the host presses Start" -->`,
  `<div style="padding:16px">${scenes.intro}</div>`);

files["components/ActionDock/preview.html"] = doc(`<!-- @dsCard group="Table" height=330 width=1580 subtitle="One dock, every decision" -->`,
  `<div class="kh kh-bg" style="display:grid;grid-template-columns:repeat(6,248px);gap:12px;padding:16px">${[
    ["Watching", dock.watch("Anna", "Bidding on your Horse", 12, 0.6)],
    ["Your turn", dock.turn(31, 17, 0.85)],
    ["Bid turn", dock.bid(100, 90, "Anna", 14, 0.7)],
    ["Auctioneer", dock.decide(120, "Clara", false, 4, 0.2)],
    ["Payment", dock.pay(160, "Ben", 110, 9, 0.45)],
    ["Defending", dock.respond("Anna", 2, "pig", 3, 0, 11, 0.55)],
  ].map(([t, h]) => `<div class="kh-col" style="gap:6px"><span class="kh-cap">${t}</span><div style="height:270px;display:flex">${h.replace('class="kh-dock', 'style="flex:1" class="kh-dock')}</div></div>`).join("")}</div>`);

files["components/SeatPod/preview.html"] = doc(`<!-- @dsCard group="Table" height=300 width=760 subtitle="Opponent at the table — fits all ten animal types" -->`,
  `<div class="kh kh-bg" style="padding:16px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px;grid-auto-rows:58px">
${pod({ name: "Anna", herd: [["goose", 2], ["pig", 1]], money: 6, active: true, secs: 12, p: 0.6 })}
${pod({ name: "Ben", herd: [["cat", 1], ["horse", 1]], money: 9, pills: ["Host"] })}
${pod({ name: "Clara", herd: [["rooster", 4], ["cow", 1]], money: 5, active: true, secs: 3, p: 0.15 })}
${pod({ name: "Dan", herd: [["dog", 2]], money: 8, pills: ["Away"] })}
${pod({ name: "Eve", herd: [["goat", 3]], money: 2, pills: ["Off"] })}
${pod({ name: "Frank", money: 0, out: true, pills: ["Out"] })}
${pod({ name: "Gerta", herd: [["sheep", 1]], money: 7, dim: true })}
${pod({ name: "Hieronymus the Third", herd: [["horse", 4], ["cow", 4], ["pig", 2]], money: 12 })}
${pod({ ...LATE[1] })}
${pod({ name: "Greedy", herd: ORDER.map((a, i) => [a, (i % 4) + 1]), money: 3 })}
${pod({ ...LATE[2], pills: ["Host"] })}
</div>`);

files["components/AnimalCard/preview.html"] = doc(`<!-- @dsCard group="Cards" height=300 width=760 subtitle="Tile · chip · lot card" -->`,
  `<div class="kh kh-bg" style="padding:16px" >
<div class="kh-cap" style="margin-bottom:10px">Tile — opponent pods, 22px</div>
<div class="kh-row" style="gap:14px;margin-bottom:18px">${Object.keys(VALUE).map((a, i) => tile(a, (i % 4) + 1)).join("")}</div>
<div class="kh-cap" style="margin-bottom:8px">Chip — your hand</div>
<div class="kh-row" style="gap:8px;margin-bottom:18px">${Object.keys(VALUE).map((a, i) => chip(a, (i % 4) + 1)).join("")}</div>
<div class="kh-cap" style="margin-bottom:8px">Lot card — the animal up for auction</div>
<div class="kh-row">${["rooster", "cat", "sheep", "donkey", "cow", "horse"].map(lot).join("")}</div>
</div>`);

files["components/Hand/preview.html"] = doc(`<!-- @dsCard group="Table" height=372 width=560 subtitle="Your herd and money — tap notes to pick them" -->`,
  `<div class="kh kh-bg" style="padding:16px;display:flex;flex-direction:column;gap:12px">
<div style="height:100px;display:flex"><div style="flex:1;display:flex" id="h1">${hand({ herd: [["horse", 2], ["sheep", 1], ["donkey", 1], ["rooster", 4]], money: [0, 10, 50, 100, 100, 200] })}</div></div>
<div style="height:100px;display:flex"><div style="flex:1;display:flex" id="h3">${hand({ herd: [["rooster", 4], ["goose", 1], ["cat", 2], ["dog", 1], ["sheep", 3], ["goat", 1], ["horse", 2]], money: [0, 10, 50, 100, 200] })}</div></div>
<div style="height:100px;display:flex"><div style="flex:1;display:flex" id="h2">${hand({ herd: [["horse", 2], ["sheep", 1], ["donkey", 1]], money: [0, 10, 50, 100, 100, 200], picked: [1, 2], picking: true, owed: 160 })}</div></div>
</div>`,
  `<script>
document.querySelectorAll('#h2 .kh-noteb').forEach(function(b){b.addEventListener('click',function(){
  b.setAttribute('aria-pressed', b.getAttribute('aria-pressed')==='true'?'false':'true');
  var t=0; document.querySelectorAll('#h2 .kh-noteb[aria-pressed=true] img').forEach(function(i){t+=Number(i.alt)});
  document.querySelector('#h2 .sum b').firstChild.nodeValue=String(t);
});});
document.querySelectorAll('#h1 .kh-hand,#h2 .kh-hand,#h3 .kh-hand').forEach(function(h){h.style.flex='1'});
</script>`);

files["components/MoneyNote/preview.html"] = doc(`<!-- @dsCard group="Cards" height=150 width=620 subtitle="The six notes and the face-down back" -->`,
  `<div class="kh kh-bg" style="padding:16px"><div class="kh-row" style="gap:10px;align-items:flex-end">${[0, 10, 50, 100, 200, 500].map((v) => `<div class="kh-col" style="gap:4px;align-items:center">${note(v)}<span class="kh-cap">${v}</span></div>`).join("")}<div class="kh-col" style="gap:4px;align-items:center">${note(0).replace(/src="[^"]+"/, `src="${BACK}"`)}<span class="kh-cap">Back</span></div></div>
<div class="kh-row" style="margin-top:16px;gap:16px"><span class="kh-cap">Selected</span><button class="kh-noteb" aria-pressed="true">${note(100)}</button><button class="kh-noteb" aria-pressed="false">${note(100)}</button><span class="kh-cap">Count in a pod</span>${backs(7)}</div></div>`);

files["components/Stage/preview.html"] = doc(`<!-- @dsCard group="Table" height=520 width=560 subtitle="The felt in the middle: deck, donkeys, lot, bids" -->`,
  `<div class="kh kh-bg" style="padding:16px;display:grid;gap:10px;grid-auto-rows:148px">
<div class="kh-stage">${pile(27, 1)}${lot("horse")}<div class="kh-info"><span class="kh-cap">Auction · Your lot</span><div class="kh-big">120<small>Clara</small></div><div class="kh-bidders"><span class="kh-bidder now">Anna</span><span class="kh-bidder passed">Ben</span><span class="kh-bidder top">Clara <b>120</b></span><span class="kh-bidder excl">Dan · bluffed</span></div></div></div>
<div class="kh-stage">${pile(0, 4)}<div class="kh-info"><span class="kh-cap">Cow trade · 2 Pigs · repeat 1 of 3</span><div class="kh-offer"><div class="side"><span class="kh-cap">Anna</span><div class="notes">${back()}${back()}${back()}</div></div><span class="vs">vs</span><div class="side"><span class="kh-cap">Ben</span><div class="notes">${back()}${back()}</div></div></div></div></div>
<div class="kh-stage">${pile(40, 0)}<div class="kh-info"><span class="kh-cap">Round 1</span><div class="kh-banner">Clara opens. <span>Choosing an action.</span></div></div></div>
</div>`);

files["components/CountdownRing/preview.html"] = doc(`<!-- @dsCard group="Status" height=120 width=520 subtitle="Server-deadline countdown" -->`,
  `<div class="kh kh-bg" style="padding:16px"><div class="kh-row" style="gap:18px">${ring(20, 1, "lg")}${ring(12, 0.6, "lg")}${ring(4, 0.2, "lg low")}${ring(17, 0.85)}${ring(3, 0.15, "low")}${ring("A", 0, "idle")}</div></div>`,
  `<script>
var r=document.querySelector('.kh-ring'),t=20;setInterval(function(){t=t<=0?20:t-1;r.style.setProperty('--p',t/20);r.classList.toggle('low',t<=5);r.firstChild.textContent=t;},1000);
</script>`);

files["components/Button/preview.html"] = doc(`<!-- @dsCard group="Actions" height=150 width=620 subtitle="Primary, secondary, quick, disabled-with-reason" -->`,
  `<div class="kh" style="background:var(--felt-deep);padding:16px;display:grid;grid-template-columns:repeat(4,1fr);gap:10px;align-items:start">
<button class="kh-btn big">Auction<small>Flip the top card · 31 left</small></button>
<button class="kh-btn big secondary">Cow trade<small>Challenge someone</small></button>
<button class="kh-btn big secondary" disabled>Buy it<small>You can’t cover 120</small></button>
<div class="kh-three"><button class="kh-btn quick">+10</button><button class="kh-btn quick">+50</button><button class="kh-btn quick">+100</button></div>
</div>`);

files["components/HerdBoard/preview.html"] = doc(`<!-- @dsCard group="Table" height=392 width=812 subtitle="Every herd side by side" -->`,
  `<div style="padding:16px"><div class="kh" style="position:relative;width:780px;height:360px;background:var(--felt-dark)">${herdBoard({ players: LATE, meName: "You", focus: "Anna", trade: LATE_TRADE, secs: 14, p: 0.7 })}</div></div>`);

files["components/LogTicker/preview.html"] = doc(`<!-- @dsCard group="Table" height=110 width=560 subtitle="The latest log line, always visible" -->`,
  `<div class="kh kh-bg" style="padding:16px;display:flex;flex-direction:column;gap:8px">${ticker("Donkey! Everyone receives 100", "Ben is auctioning")}${ticker("Ben forfeited the Cow trade to Clara", "Clara challenged Ben for 1 Cow")}</div>`);

for (const [p, s] of Object.entries(files)) {
  const f = join(OUT, p);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, s);
}
console.log(Object.keys(files).length, "files");
