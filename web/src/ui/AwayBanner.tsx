import { sendOrToast } from "../net/socket";

export function AwayBanner() {
  return (
    <div class="away-banner">
      <span>You're marked Away.</span>
      <button onClick={() => sendOrToast({ type: "imBack" })}>I'm back</button>
    </div>
  );
}
