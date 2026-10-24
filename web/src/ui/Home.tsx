import { newRoomId } from "../net/roomId";
import { startConnection } from "../net/socket";
import { homeScreen, notice, toast } from "../state";

export function Home() {
  return (
    <div class="center">
      <h1>Kuhhandel</h1>
      {notice.value && (
        <p class="notice">
          {notice.value}{" "}
          <button class="link" aria-label="Dismiss" onClick={() => { notice.value = null; }}>x</button>
        </p>
      )}
      <div class="row">
        <button onClick={() => { toast.value = null; startConnection(newRoomId()); homeScreen.value = "create"; }}>Create room</button>
        <button onClick={() => { toast.value = null; homeScreen.value = "join"; }}>Join room</button>
      </div>
    </div>
  );
}
