import { useState } from "preact/hooks";
import { nameProblem } from "../model/lobby";
import { sendOrToast } from "../net/socket";
import { homeScreen, toast } from "../state";

export function JoinLink(props: { roomId: string }) {
  const [playerName, setPlayerName] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const submit = (e: Event) => {
    e.preventDefault();
    toast.value = null;
    const p = nameProblem(playerName);
    setProblem(p);
    if (p !== null) return;
    sendOrToast({ type: "joinRoom", roomId: props.roomId, playerName: playerName.trim() });
  };

  return (
    <form class="form" onSubmit={submit}>
      <h2>Join room</h2>
      <div class="fields">
        <input placeholder="Your name" value={playerName} onInput={(e) => { toast.value = null; setPlayerName(e.currentTarget.value); }} />
      </div>
      {[...(problem ? [problem] : []), ...(toast.value ? [toast.value] : [])].map((m) => <p class="error">{m}</p>)}
      <div class="row">
        <button type="button" class="link" onClick={() => { toast.value = null; homeScreen.value = "home"; }}>Back</button>
        <button type="submit">Join room</button>
      </div>
    </form>
  );
}
