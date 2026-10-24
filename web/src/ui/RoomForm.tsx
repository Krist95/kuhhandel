import { useState } from "preact/hooks";
import { formProblems, type RoomFormValues } from "../model/lobby";
import { sendOrToast } from "../net/socket";
import { homeScreen, notice, toast } from "../state";

export function RoomForm() {
  const [f, setF] = useState<RoomFormValues>({ roomName: "", playerName: "" });
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
        <input placeholder="Your name" value={f.playerName} maxLength={24} onInput={(e) => set({ playerName: e.currentTarget.value })} />
      </div>
      {[...problems, ...(toast.value ? [toast.value] : [])].map((m) => <p class="error">{m}</p>)}
      <div class="row">
        <button type="button" class="link" onClick={() => { toast.value = null; notice.value = null; homeScreen.value = "home"; }}>Back</button>
        <button type="submit">Create room</button>
      </div>
    </form>
  );
}
