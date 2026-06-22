export type Color = "red" | "blue" | "green" | "yellow";

export type Action =
  | "skip"
  | "reverse"
  | "draw2"
  | "wild"
  | "wild4";

export interface Card {
  id: string;
  color: Color | null;
  value: number | Action;
}

export interface Player {
  id: string;
  name: string;
  cards: Card[];
  isHuman: boolean;
  saidUno: boolean;
}

export type GamePhase =
  | "idle"
  | "playing"
  | "pickColor"
  | "challenge"       // human can challenge the AI's wild4
  | "drawnCard"       // human drew a card and can optionally play it
  | "won";

export type Difficulty = "easy" | "medium" | "hard";

export interface Toast {
  id: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
}