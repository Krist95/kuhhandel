import type { PublicPhase } from "../../../src/protocol";

/** The player the game is waiting on, or null when nobody (bluff reveal). */
export function waitingOnPublic(phase: PublicPhase): string | null {
  switch (phase.kind) {
    case "action": return phase.playerId;
    case "bidding": return phase.turnId;
    case "decision": return phase.auctioneerId;
    case "payment": return phase.payerId;
    case "tradeSetup": return phase.challengerId;
    case "tradeResponse": return phase.terms.defenderId;
    case "bluff": return null;
  }
}
