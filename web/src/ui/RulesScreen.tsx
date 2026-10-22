import { AWAY_AFTER, DONKEY_PAYOUTS, MAX_TIES, type Settings } from "../../../src/rules/types";
import { moneyRuleText } from "../model/reveals";

export function RulesScreen(props: { settings: Settings; onClose: () => void }) {
  return (
    <div class="dialog-backdrop" role="dialog" aria-modal="true">
      <div class="sheet rules">
        <div class="rules-body">
          <h2>Rules</h2>
          <p><b>Your turn.</b> Start an auction with the top card of the deck, or challenge a player to a Cow trade.</p>
          <p><b>Auction and bluffing.</b> Everyone else bids openly. The auctioneer may sell to the top bidder or buy the card at that bid. If a bidder cannot pay, the bluff is revealed and they are excluded.</p>
          <p><b>Buy.</b> The auctioneer may take the card by paying the top bidder the top bid.</p>
          <p><b>Cow trade.</b> Challenge a player who holds the same animal. Both secretly put down money; the higher total wins the animals. A tie repeats the trade, up to {MAX_TIES} times.</p>
          <p><b>Donkeys.</b> Each donkey pays everyone: {DONKEY_PAYOUTS.join(", ")}.</p>
          <p><b>Scoring.</b> Each complete set of four is worth its value; the sum is multiplied by the number of sets. Highest score wins. On equal scores, more complete sets wins; only an equal score and an equal number of sets share the win.</p>
          <p><b>Away.</b> After {AWAY_AFTER} timeouts in a row you are marked Away and play automatically until you return.</p>
          <h3>Settings</h3>
          <p>{moneyRuleText(props.settings.moneyRule)}</p>
          <p>Time per decision: {props.settings.decisionSeconds} s</p>
        </div>
        <button onClick={props.onClose}>Close</button>
      </div>
    </div>
  );
}
