import { useState } from "preact/hooks";
import { formProblems, normalizeRoomId, savePassword, type RoomFormValues } from "../model/lobby";
import { sendOrToast } from "../net/socket";
import { homeScreen, notice, toast } from "../state";

function store(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

export function RoomForm(props: { mode: "create" | "join" }) {
  const { mode } = props;
  const [f, setF] = useState<RoomFormValues>({ roomName: "", roomId: "", password: "", playerName: "", seat: null });
  const [problems, setProblems] = useState<string[]>([]);
  const set = (patch: Partial<RoomFormValues>) => { toast.value = null; setF({ ...f, ...patch }); };

  const submit = (e: Event) => {
    e.preventDefault();
    toast.value = null;
    const p = formProblems(f, mode);
    setProblems(p);
    if (p.length > 0 || f.seat === null) return;
    savePassword(store(), f.password);
    const playerName = f.playerName.trim();
    if (mode === "create") sendOrToast({ type: "createRoom", roomName: f.roomName.trim(), password: f.password, playerName, seat: f.seat });
    else sendOrToast({ type: "joinRoom", roomId: normalizeRoomId(f.roomId), password: f.password, playerName, seat: f.seat });
  };

  return (
    <form class="form" onSubmit={submit}>
      <h2>{mode === "create" ? "Create room" : "Join room"}</h2>
      <div class="fields">
        {mode === "create"
          ? <input placeholder="Room name" value={f.roomName} maxLength={24} onInput={(e) => set({ roomName: e.currentTarget.value })} />
          : <input placeholder="Room ID" value={f.roomId} autocapitalize="characters" onInput={(e) => set({ roomId: e.currentTarget.value })} />}
        <input placeholder="Password" value={f.password} maxLength={64} onInput={(e) => set({ password: e.currentTarget.value })} />
        <input placeholder="Your name" value={f.playerName} onInput={(e) => set({ playerName: e.currentTarget.value })} />
      </div>
      <div class="row seats" role="group" aria-label="Seat">
        <span>Seat</span>
        {[1, 2, 3, 4, 5].map((n) => (
          <button type="button" class={f.seat === n ? "" : "secondary"} aria-pressed={f.seat === n} onClick={() => set({ seat: n })}>{n}</button>
        ))}
      </div>
      {[...problems, ...(toast.value ? [toast.value] : [])].map((m) => <p class="error">{m}</p>)}
      <div class="row">
        <button type="button" class="link" onClick={() => { toast.value = null; notice.value = null; homeScreen.value = "home"; }}>Back</button>
        <button type="submit">{mode === "create" ? "Create room" : "Join room"}</button>
      </div>
    </form>
  );
}
