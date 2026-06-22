import { Card, Color, Player } from "@/types/uno";

export function canPlayCard(
  card: Card,
  topCard: Card,
  activeColor?: Color | null
): boolean {
  if (card.value === "wild" || card.value === "wild4") return true;
  const currentColor = activeColor ?? topCard.color;
  return card.color === currentColor || card.value === topCard.value;
}

export function nextPlayerIndex(
  current: number,
  direction: 1 | -1,
  playerCount: number
): number {
  return ((current + direction + playerCount) % playerCount);
}

export function calculateScore(players: Player[]): number {
  // Sum of all cards in losing players' hands
  return players.reduce((total, player) => {
    return (
      total +
      player.cards.reduce((sum, card) => {
        if (typeof card.value === "number") return sum + card.value;
        if (card.value === "wild" || card.value === "wild4") return sum + 50;
        return sum + 20; // skip, reverse, draw2
      }, 0)
    );
  }, 0);
}

export function checkWinner(players: Player[]): Player | null {
  return players.find((p) => p.cards.length === 0) ?? null;
}

export function getPlayableCards(
  hand: Card[],
  topCard: Card,
  activeColor: Color | null
): Card[] {
  return hand.filter((card) => canPlayCard(card, topCard, activeColor));
}