import { Card, Color, Player, Difficulty } from "@/types/uno";
import { getPlayableCards } from "@/lib/gameEngine";

function pickBestColor(hand: Card[]): Color {
  const counts: Record<Color, number> = {
    red: 0,
    blue: 0,
    green: 0,
    yellow: 0,
  };
  hand.forEach((c) => {
    if (c.color) counts[c.color]++;
  });
  const entries = Object.entries(counts) as [Color, number][];
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export type AiAction =
  | { type: "play"; card: Card; color?: Color }
  | { type: "draw" };

export function computeAiAction(
  player: Player,
  topCard: Card,
  activeColor: Color | null,
  opponentCardCount: number,
  difficulty: Difficulty
): AiAction {
  const playable = getPlayableCards(player.cards, topCard, activeColor);

  if (playable.length === 0) return { type: "draw" };

  if (difficulty === "easy") {
    const card = randomItem(playable);
    const color =
      card.value === "wild" || card.value === "wild4"
        ? pickBestColor(player.cards)
        : undefined;
    return { type: "play", card, color };
  }

  // Medium / Hard: strategic selection
  // Priority: Wild4 when opponent is close to winning > action cards > color match > other
  let selected: Card | null = null;

  // 1. Use Wild4 if opponent has <= 3 cards
  if (opponentCardCount <= 3) {
    const wild4 = playable.find((c) => c.value === "wild4");
    if (wild4) selected = wild4;
  }

  // 2. Prefer action cards (skip, reverse, draw2, wild4)
  if (!selected) {
    const action = playable.find(
      (c) =>
        c.value === "skip" ||
        c.value === "reverse" ||
        c.value === "draw2" ||
        c.value === "wild4"
    );
    if (action) selected = action;
  }

  // 3. Prefer matching color (to keep control)
  if (!selected) {
    const colorMatch = playable.find((c) => c.color === activeColor);
    if (colorMatch) selected = colorMatch;
  }

  // 4. Use wild to switch to best color
  if (!selected) {
    const wild = playable.find((c) => c.value === "wild");
    if (wild) selected = wild;
  }

  // 5. Any other playable
  if (!selected) selected = playable[0];

  const color =
    selected.value === "wild" || selected.value === "wild4"
      ? pickBestColor(player.cards)
      : undefined;

  return { type: "play", card: selected, color };
}
