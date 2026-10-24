import { useState } from "preact/hooks";
import { normalizeRoomId } from "../model/lobby";
import { startConnection } from "../net/socket";
import { homeScreen, toast } from "../state";
import { QrScanner } from "./QrScanner";

export function JoinRoom() {
  const [roomId, setRoomId] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const submit = (e: Event) => {
    e.preventDefault();
    toast.value = null;
    const normalized = normalizeRoomId(roomId);
    if (normalized.length === 0) { setProblem("Enter a room ID."); return; }
    setProblem(null);
    startConnection(normalized);
    homeScreen.value = { join: normalized };
  };

  if (scanning) {
    return (
      <QrScanner
        onResult={(scannedRoomId) => {
          setScanning(false);
          startConnection(scannedRoomId);
          homeScreen.value = { join: scannedRoomId };
        }}
        onCancel={() => setScanning(false)}
      />
    );
  }

  return (
    <form class="form" onSubmit={submit}>
      <h2>Join room</h2>
      <div class="row">
        <input placeholder="Room ID" value={roomId} onInput={(e) => { setProblem(null); setRoomId(e.currentTarget.value); }} />
        <button type="submit">Join</button>
      </div>
      {problem && <p class="error">{problem}</p>}
      <div class="row">
        <button type="button" onClick={() => setScanning(true)}>Scan QR</button>
      </div>
      <div class="row">
        <button type="button" class="link" onClick={() => { toast.value = null; homeScreen.value = "home"; }}>Back</button>
      </div>
    </form>
  );
}
