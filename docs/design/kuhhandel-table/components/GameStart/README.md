A 3-second overlay shown once when a game starts: who goes first, the turn order, and the notes you were dealt.

**When** — the first view where `room.game` exists and its log has only the start entry; remember it per room + game (same pattern as `model/reveals.ts`). Also after Play again.

**Shows** — `label` "Shuffled · 40 animals · 4 donkeys somewhere"; headline "*Name* goes first." in `display` with the name in `accent` (or "*You* go first."); one deadpan line ("Picked at random. Complaints go to the random number generator."); the turn order as pills from the first player, `accent` on the first, a `paper` ring on you; your seven notes and the total 90; a draining `accent` bar.

**Behaviour** — dismisses after 3s or on tap. The first player's decision timer is already running underneath (server-side), which is why it stays short. Don't block input to the dock behind it if it's your turn: dismiss immediately when the player taps anywhere.
