import { homeScreen, notice, toast } from "../state";

export function Home() {
  const go = (s: "create" | "join") => { toast.value = null; homeScreen.value = s; };
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
        <button onClick={() => go("create")}>Create room</button>
        <button onClick={() => go("join")}>Join room</button>
      </div>
    </div>
  );
}
