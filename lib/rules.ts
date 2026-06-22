import { Card, Color, Player } from "@/types/uno";

/**
 * Returns true if the player legitimately has no card of the active color
 * (used for Wild Draw Four challenge validation).
 */
export function playerHadNoColor(
  hand: Card[],
  activeColor: Color | null
): boolean {
  if (!activeColor) return true;
  return !hand.some(
    (c) => c.color === activeColor && c.value !== "wild4"
  );
}

/**
 * Calculate penalty when a Wild Draw Four challenge resolves.
 * Returns { playerDraws, challengerDraws } — one of them will be 0.
 */
export function resolveChallenge(
  challengeSucceeds: boolean
): { playerDraws: number; challengerDraws: number } {
  if (challengeSucceeds) {
    // Original player draws 4 instead; challenger draws 0
    return { playerDraws: 4, challengerDraws: 0 };
  } else {
    // Challenger draws 6 (4 original + 2 penalty)
    return { playerDraws: 0, challengerDraws: 6 };
  }
}

/**
 * Returns true if a player must be penalized for not calling UNO
 * (they have exactly 1 card and saidUno is false).
 */
export function mustPenalizeUno(player: Player): boolean {
  return player.cards.length === 1 && !player.saidUno;
}
