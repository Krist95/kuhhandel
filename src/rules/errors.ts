export const ERROR_TEXT = {
  roomInUse: "A room is already in use. Ask the host for the room ID and password.",
  badCredentials: "Room not found or wrong password.",
  gameStarted: "This game has already started",
  tooManyAttempts: "Too many failed attempts. Wait a minute and try again.",
  blocked: "You were removed from this room.",
  badName: "Names must be 1–16 characters.",
  nameTaken: "That name is already taken.",
  badRoomName: "Room name must be 1–24 characters.",
  badSeat: "Pick a seat from 1 to 5.",
  seatTaken: "That seat is taken.",
  roomFull: "The room is full.",
  roomNotFound: "Room not found.",
  alreadySeated: "You already have a seat.",
  notSeated: "You are not in this room.",
  notHost: "Only the host can do that.",
  notEnoughPlayers: "You need 3–5 players to start.",
  paused: "The game is paused.",
  notYourTurn: "It's not your turn.",
  deckEmpty: "The deck is empty.",
  cantTrade: "No cow trade is possible.",
  badBid: "Bid a multiple of 10 above the top bid.",
  buyDisabled: "You can't afford to buy it.",
  badCards: "Pick cards from your own hand.",
  underpaid: "Those cards don't cover the amount.",
  badTrade: "That cow trade isn't allowed.",
  badMessage: "Invalid message.",
  invalid: "That isn't possible right now.",
} as const;

export type ErrorCode = keyof typeof ERROR_TEXT;

export class RuleError extends Error {
  constructor(readonly code: ErrorCode) {
    super(ERROR_TEXT[code]);
  }
}
