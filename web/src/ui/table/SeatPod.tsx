import type { PublicPlayer } from "../../../../src/protocol";
import { ANIMAL_NAME } from "../../../../src/rules/types";
import { ledger, podBadge } from "../../model/herds";
import { Backs } from "./Money";
import { CountdownRing } from "./CountdownRing";

function Ledger(props: { herd: PublicPlayer["herd"] }) {
  const entries = ledger(props.herd);
  const owned = entries.filter((e) => e.count > 0).map((e) => `${ANIMAL_NAME[e.animal][0]} ${e.count}`).join(", ");
  return (
    <span class="kh-ledger" aria-label={owned || "No animals"}>
      {entries.map((e) => (
        <span key={e.animal} class={e.count === 0 ? "none" : e.set ? "set" : ""} style={{ "--c": `var(--animal-${e.animal})` } as any}>
          {[0, 1, 2, 3].map((i) => <i key={i} class={i < e.count ? "on" : ""} />)}
        </span>
      ))}
    </span>
  );
}

export function SeatPod(props: { player: PublicPlayer; isHost: boolean; active: boolean; dim: boolean; deadline: number | null; decisionSeconds: number; paused: boolean; onOpen: () => void }) {
  const { player } = props;
  const badge = podBadge(player, props.isHost);
  const cls = ["kh-pod", props.active && "active", props.dim && "dim", player.out && "out"].filter(Boolean).join(" ");
  const initial = player.name[0];
  return (
    <button class={cls} onClick={props.onOpen}>
      <span class="av">
        <CountdownRing deadline={props.active ? props.deadline : null} decisionSeconds={props.decisionSeconds} paused={props.paused} idleLabel={initial} />
        {badge && <span class={`kh-pill ${badge === "Offline" ? "off" : badge.toLowerCase()}`}>{badge}</span>}
      </span>
      <span class="meta">
        <span class="top"><span class="nm">{player.name}</span><Backs count={player.moneyCount} /></span>
        <span class="herd">{player.out ? <em>Out · watching</em> : <Ledger herd={player.herd} />}</span>
      </span>
    </button>
  );
}
