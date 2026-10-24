import { useState } from "preact/hooks";
import { DECISION_SECONDS } from "../../../src/rules/types";
import { formProblems, type RoomFormValues } from "../model/lobby";
import { sendOrToast } from "../net/socket";
import { homeScreen, notice, toast } from "../state";

export function RoomForm() {
  const [f, setF] = useState<RoomFormValues>({ roomName: "", playerName: "", moneyRule: "swap", decisionSeconds: 20 });
  const [problems, setProblems] = useState<string[]>([]);
  const set = (patch: Partial<RoomFormValues>) => { toast.value = null; setF({ ...f, ...patch }); };

  const submit = (e: Event) => {
    e.preventDefault();
    toast.value = null;
    const p = formProblems(f, "create");
    setProblems(p);
    if (p.length > 0) return;
    sendOrToast({ type: "createRoom", roomName: f.roomName.trim(), playerName: f.playerName.trim() });
  };

  return (
    <form class="form" onSubmit={submit}>
      <h2>Create room</h2>
      <div class="fields">
        <input placeholder="Room name" value={f.roomName} maxLength={24} onInput={(e) => set({ roomName: e.currentTarget.value })} />
        <input placeholder="Your name" value={f.playerName} onInput={(e) => set({ playerName: e.currentTarget.value })} />
      </div>
      <div class="row">
        <label>Cow trade money
          <select value={f.moneyRule} onChange={(e) => set({ moneyRule: e.currentTarget.value as "swap" | "loserTakesBoth" })}>
            <option value="swap">Swap</option>
            <option value="loserTakesBoth">Loser takes both</option>
          </select>
        </label>
        <label>Time per decision
          <select value={f.decisionSeconds} onChange={(e) => set({ decisionSeconds: Number(e.currentTarget.value) })}>
            {DECISION_SECONDS.map((s) => <option value={s}>{s} s</option>)}
          </select>
        </label>
      </div>
      {[...problems, ...(toast.value ? [toast.value] : [])].map((m) => <p class="error">{m}</p>)}
      <div class="row">
        <button type="button" class="link" onClick={() => { toast.value = null; notice.value = null; homeScreen.value = "home"; }}>Back</button>
        <button type="submit">Create room</button>
      </div>
    </form>
  );
}
