import { Card, Color } from "@/types/uno";

const colors: Color[] = ["red", "blue", "green", "yellow"];

export function generateDeck(): Card[] {
  const deck: Card[] = [];

  colors.forEach((color) => {
    deck.push({ id: crypto.randomUUID(), color, value: 0 });

    for (let i = 1; i <= 9; i++) {
      for (let j = 0; j < 2; j++) {
        deck.push({ id: crypto.randomUUID(), color, value: i });
      }
    }

    (["skip", "reverse", "draw2"] as const).forEach((action) => {
      for (let i = 0; i < 2; i++) {
        deck.push({ id: crypto.randomUUID(), color, value: action });
      }
    });
  });

  for (let i = 0; i < 4; i++) {
    deck.push({ id: crypto.randomUUID(), color: null, value: "wild" });
    deck.push({ id: crypto.randomUUID(), color: null, value: "wild4" });
  }

  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * When draw pile is empty, reshuffle discard pile (except top card)
 * back into a new draw pile.
 */
export function reshuffleDiscardIntoDraw(
  drawPile: Card[],
  discardPile: Card[]
): { drawPile: Card[]; discardPile: Card[] } {
  if (drawPile.length > 0 || discardPile.length <= 1) {
    return { drawPile, discardPile };
  }
  const topCard = discardPile[discardPile.length - 1];
  const newDrawPile = shuffleDeck(discardPile.slice(0, -1));
  return { drawPile: newDrawPile, discardPile: [topCard] };
}