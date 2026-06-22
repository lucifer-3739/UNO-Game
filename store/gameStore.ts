import { create } from "zustand";
import { Card, Color, Player, GamePhase, Difficulty, Toast } from "@/types/uno";
import { generateDeck, shuffleDeck, reshuffleDiscardIntoDraw } from "@/lib/deck";
import { canPlayCard, nextPlayerIndex, calculateScore } from "@/lib/gameEngine";
import { playerHadNoColor, resolveChallenge } from "@/lib/rules";
import { computeAiAction } from "@/lib/ai";

export interface GameState {
  // ── Core game data ──────────────────────────────────────────────
  players: Player[];
  currentPlayer: number;
  drawPile: Card[];
  discardPile: Card[];
  direction: 1 | -1;
  activeColor: Color | null;
  gamePhase: GamePhase;
  winner: string | null;
  scores: Record<string, number>;      // cumulative across rounds
  roundScores: Record<string, number>; // this round only
  difficulty: Difficulty;
  roundNumber: number;

  // ── Transient UI flags ──────────────────────────────────────────
  unoCallWindow: boolean;           // human has 1 card — show UNO button
  pendingWild4Player: number | null; // who played the wild4 (for challenge)
  /** The hand of wild4 player at time of play — used for challenge validation */
  wild4PlayerHandAtPlay: Card[];
  drawnCard: Card | null;           // card just drawn (can be played immediately)
  lastPlayedCard: Card | null;
  aiThinking: boolean;
  toasts: Toast[];

  // ── Actions ─────────────────────────────────────────────────────
  initializeGame: (difficulty?: Difficulty) => void;
  playCard: (playerIndex: number, cardId: string) => void;
  drawCard: (playerIndex: number) => void;
  playDrawnCard: () => void;          // play the drawnCard immediately
  passAfterDraw: () => void;          // skip after drawing (can't/won't play)
  callUno: (playerIndex: number) => void;
  catchUno: (targetIndex: number) => void; // catch opponent who forgot UNO
  pickColor: (color: Color) => void;
  challengeWild4: (doChallenge: boolean) => void;
  resetGame: () => void;
  dismissToast: (id: string) => void;
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function drawN(
  n: number,
  drawPile: Card[],
  discardPile: Card[]
): { cards: Card[]; drawPile: Card[]; discardPile: Card[] } {
  let dp = [...drawPile];
  let disc = [...discardPile];
  const drawn: Card[] = [];
  for (let i = 0; i < n; i++) {
    if (dp.length === 0) {
      const r = reshuffleDiscardIntoDraw(dp, disc);
      dp = r.drawPile;
      disc = r.discardPile;
    }
    if (dp.length === 0) break;
    drawn.push(dp[dp.length - 1]);
    dp = dp.slice(0, -1);
  }
  return { cards: drawn, drawPile: dp, discardPile: disc };
}

let toastCounter = 0;
function makeToast(message: string, type: Toast["type"] = "info"): Toast {
  return { id: `toast-${++toastCounter}`, message, type };
}

// ─────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────

export const useGameStore = create<GameState>((set, get) => ({
  players: [],
  currentPlayer: 0,
  drawPile: [],
  discardPile: [],
  direction: 1,
  activeColor: null,
  gamePhase: "idle",
  winner: null,
  scores: {},
  roundScores: {},
  difficulty: "medium",
  roundNumber: 1,
  unoCallWindow: false,
  pendingWild4Player: null,
  wild4PlayerHandAtPlay: [],
  drawnCard: null,
  lastPlayedCard: null,
  aiThinking: false,
  toasts: [],

  // ── initializeGame ────────────────────────────────────────────
  initializeGame: (difficulty = "medium") => {
    const state = get();
    const deck = shuffleDeck(generateDeck());

    const human: Player = {
      id: "human",
      name: "You",
      cards: deck.splice(0, 7),
      isHuman: true,
      saidUno: false,
    };

    const ai: Player = {
      id: "ai",
      name: "AI",
      cards: deck.splice(0, 7),
      isHuman: false,
      saidUno: false,
    };

    // First card must not be a wild
    let firstCard = deck.pop()!;
    while (firstCard.value === "wild" || firstCard.value === "wild4") {
      deck.unshift(firstCard);
      firstCard = deck.pop()!;
    }

    let players: Player[] = [human, ai];
    let drawPile = [...deck];
    let discardPile = [firstCard];
    let activeColor: Color | null = firstCard.color;
    let currentPlayer = 0;
    let direction: 1 | -1 = 1;
    const toasts: Toast[] = [];

    // Apply first-card effects
    if (firstCard.value === "skip") {
      currentPlayer = nextPlayerIndex(0, direction, 2);
      toasts.push(makeToast("First card is Skip — AI goes first!", "info"));
    } else if (firstCard.value === "reverse") {
      direction = -1;
      // With 2 players reverse = skip
      currentPlayer = nextPlayerIndex(0, direction, 2);
      toasts.push(makeToast("First card is Reverse — AI goes first!", "info"));
    } else if (firstCard.value === "draw2") {
      // Human draws 2 and loses turn
      const drawn = drawN(2, drawPile, discardPile);
      drawPile = drawn.drawPile;
      discardPile = drawn.discardPile;
      players[0] = { ...players[0], cards: [...players[0].cards, ...drawn.cards] };
      currentPlayer = nextPlayerIndex(0, direction, 2);
      toasts.push(makeToast("First card is Draw Two — you draw 2 and AI goes first!", "warning"));
    }

    set({
      players,
      currentPlayer,
      drawPile,
      discardPile,
      direction,
      activeColor,
      gamePhase: "playing",
      winner: null,
      difficulty,
      roundNumber: state.roundNumber,
      roundScores: {},
      unoCallWindow: false,
      pendingWild4Player: null,
      wild4PlayerHandAtPlay: [],
      drawnCard: null,
      lastPlayedCard: firstCard,
      aiThinking: false,
      toasts,
    });

    // If AI starts, schedule its turn
    if (currentPlayer !== 0) {
      scheduleAiTurn();
    }
  },

  // ── playCard ──────────────────────────────────────────────────
  playCard: (playerIndex, cardId) => {
    const state = get();
    if (state.gamePhase !== "playing") return;
    if (state.currentPlayer !== playerIndex) return;

    const player = state.players[playerIndex];
    const card = player.cards.find((c) => c.id === cardId);
    if (!card) return;

    const topCard = state.discardPile[state.discardPile.length - 1];
    if (!canPlayCard(card, topCard, state.activeColor)) {
      set({ toasts: [...state.toasts, makeToast("That card can't be played here!", "error")] });
      return;
    }

    // Remove card from hand
    const newPlayers = state.players.map((p, i) =>
      i === playerIndex
        ? { ...p, cards: p.cards.filter((c) => c.id !== cardId), saidUno: false }
        : p
    );

    const newDiscardPile = [...state.discardPile, card];

    // ── Win check ──
    if (newPlayers[playerIndex].cards.length === 0) {
      // Check UNO rule: must have said UNO before playing last card
      // (if saidUno was false before, they get penalised — but they've already won so skip)
      const score = calculateScore(newPlayers.filter((_, i) => i !== playerIndex));
      const newScores = {
        ...state.scores,
        [player.id]: (state.scores[player.id] ?? 0) + score,
      };
      set({
        players: newPlayers,
        discardPile: newDiscardPile,
        lastPlayedCard: card,
        gamePhase: "won",
        winner: player.name,
        scores: newScores,
        roundScores: { [player.id]: score },
        toasts: [...state.toasts, makeToast(`${player.name} wins this round! +${score} points`, "success")],
      });
      return;
    }

    // ── UNO window ── (human drops to 1 card)
    const unoCallWindow = newPlayers[playerIndex].cards.length === 1 && player.isHuman;

    // ── Card effects ──
    let direction = state.direction;
    let nextPlayer = nextPlayerIndex(playerIndex, direction, newPlayers.length);
    let newGamePhase: GamePhase = "playing";
    let drawPile = [...state.drawPile];
    let discardPile = newDiscardPile;
    let pendingWild4Player: number | null = null;
    let wild4PlayerHandAtPlay: Card[] = [];
    const toasts: Toast[] = [...state.toasts];

    if (card.value === "skip") {
      nextPlayer = nextPlayerIndex(nextPlayer, direction, newPlayers.length);
      toasts.push(makeToast(`${player.name} played Skip!`, "info"));
    } else if (card.value === "reverse") {
      direction = (direction * -1) as 1 | -1;
      if (newPlayers.length === 2) {
        // With 2 players, Reverse acts like Skip — current player goes again
        nextPlayer = playerIndex;
      } else {
        nextPlayer = nextPlayerIndex(playerIndex, direction, newPlayers.length);
      }
      toasts.push(makeToast(`${player.name} reversed direction!`, "info"));
    } else if (card.value === "draw2") {
      const drawn = drawN(2, drawPile, discardPile);
      drawPile = drawn.drawPile;
      discardPile = drawn.discardPile;
      const target = nextPlayer;
      newPlayers.splice(target, 1, {
        ...newPlayers[target],
        cards: [...newPlayers[target].cards, ...drawn.cards],
      });
      nextPlayer = nextPlayerIndex(target, direction, newPlayers.length);
      toasts.push(makeToast(`${newPlayers[target]?.name ?? "Next player"} draws 2 cards!`, "warning"));
    } else if (card.value === "wild") {
      // Human picks color; AI picks immediately
      if (player.isHuman) {
        newGamePhase = "pickColor";
        nextPlayer = playerIndex; // hold position
      } else {
        // AI picks best color inline (caller handles it)
        newGamePhase = "pickColor";
        nextPlayer = playerIndex;
      }
      toasts.push(makeToast(`${player.name} played Wild!`, "info"));
    } else if (card.value === "wild4") {
      // Save hand at time of play for challenge validation
      wild4PlayerHandAtPlay = player.cards.filter((c) => c.id !== cardId);
      pendingWild4Player = playerIndex;

      if (player.isHuman) {
        // Human picks color; after that next player may challenge
        newGamePhase = "pickColor";
        nextPlayer = playerIndex;
      } else {
        // AI played wild4 — human gets to challenge before color pick
        newGamePhase = "challenge";
        nextPlayer = playerIndex; // hold until challenge resolved
      }
      toasts.push(makeToast(`${player.name} played Wild Draw Four!`, "warning"));
    }

    const activeColor =
      card.color ??
      (card.value === "wild" || card.value === "wild4" ? null : state.activeColor);

    set({
      players: newPlayers,
      discardPile,
      drawPile,
      direction,
      activeColor,
      currentPlayer: nextPlayer,
      gamePhase: newGamePhase,
      unoCallWindow,
      pendingWild4Player,
      wild4PlayerHandAtPlay,
      lastPlayedCard: card,
      drawnCard: null,
      aiThinking: false,
      toasts,
    });

    if (newGamePhase === "playing" && !newPlayers[nextPlayer].isHuman) {
      scheduleAiTurn();
    }
  },

  // ── drawCard ──────────────────────────────────────────────────
  drawCard: (playerIndex) => {
    const state = get();
    if (state.gamePhase !== "playing") return;
    if (state.currentPlayer !== playerIndex) return;

    const drawn = drawN(1, state.drawPile, state.discardPile);
    if (drawn.cards.length === 0) return;

    const drawnCard = drawn.cards[0];
    const topCard = state.discardPile[state.discardPile.length - 1];
    const canPlay = canPlayCard(drawnCard, topCard, state.activeColor);

    const updatedPlayers = state.players.map((p, i) =>
      i === playerIndex ? { ...p, cards: [...p.cards, drawnCard] } : p
    );

    const isHuman = state.players[playerIndex].isHuman;

    if (isHuman && canPlay) {
      // Enter drawnCard phase — human may choose to play it or pass
      set({
        players: updatedPlayers,
        drawPile: drawn.drawPile,
        discardPile: drawn.discardPile,
        drawnCard,
        gamePhase: "drawnCard",
        toasts: [...state.toasts, makeToast("You drew a playable card — play it or pass!", "info")],
      });
    } else {
      // Can't play it → advance turn immediately
      const nextPlayer = nextPlayerIndex(playerIndex, state.direction, updatedPlayers.length);
      set({
        players: updatedPlayers,
        drawPile: drawn.drawPile,
        discardPile: drawn.discardPile,
        drawnCard: null,
        currentPlayer: nextPlayer,
        unoCallWindow: false,
      });
      if (!updatedPlayers[nextPlayer].isHuman) scheduleAiTurn();
    }
  },

  // ── playDrawnCard ─────────────────────────────────────────────
  playDrawnCard: () => {
    const state = get();
    if (state.gamePhase !== "drawnCard" || !state.drawnCard) return;
    const card = state.drawnCard;
    set({ gamePhase: "playing", drawnCard: null });
    // Now play it like a normal card
    get().playCard(state.currentPlayer, card.id);
  },

  // ── passAfterDraw ─────────────────────────────────────────────
  passAfterDraw: () => {
    const state = get();
    if (state.gamePhase !== "drawnCard") return;
    const nextPlayer = nextPlayerIndex(state.currentPlayer, state.direction, state.players.length);
    set({
      gamePhase: "playing",
      drawnCard: null,
      currentPlayer: nextPlayer,
      unoCallWindow: false,
    });
    if (!state.players[nextPlayer].isHuman) scheduleAiTurn();
  },

  // ── callUno ───────────────────────────────────────────────────
  callUno: (playerIndex) => {
    const state = get();
    const player = state.players[playerIndex];
    if (!player || player.cards.length !== 1) return;

    set({
      players: state.players.map((p, i) =>
        i === playerIndex ? { ...p, saidUno: true } : p
      ),
      unoCallWindow: false,
      toasts: [...state.toasts, makeToast("UNO! 🎴", "success")],
    });
  },

  // ── catchUno ──────────────────────────────────────────────────
  catchUno: (targetIndex) => {
    const state = get();
    const target = state.players[targetIndex];
    // Can only catch if target has 1 card and didn't say UNO
    if (!target || target.cards.length !== 1 || target.saidUno) {
      set({ toasts: [...state.toasts, makeToast("Too late — they already called UNO!", "error")] });
      return;
    }
    // Target draws 2 penalty cards
    const drawn = drawN(2, state.drawPile, state.discardPile);
    const updatedPlayers = state.players.map((p, i) =>
      i === targetIndex
        ? { ...p, cards: [...p.cards, ...drawn.cards] }
        : p
    );
    set({
      players: updatedPlayers,
      drawPile: drawn.drawPile,
      discardPile: drawn.discardPile,
      toasts: [...state.toasts, makeToast(`${target.name} forgot UNO! +2 penalty cards 🃏`, "warning")],
    });
  },

  // ── pickColor ─────────────────────────────────────────────────
  pickColor: (color) => {
    const state = get();
    if (state.gamePhase !== "pickColor") return;

    const players = [...state.players];
    let drawPile = [...state.drawPile];
    let discardPile = [...state.discardPile];
    const wild4Player = state.pendingWild4Player;
    const toasts: Toast[] = [...state.toasts, makeToast(`Color changed to ${color}!`, "info")];

    if (wild4Player !== null) {
      // Wild Draw Four: next player draws 4, then turn advances past them
      const targetIndex = nextPlayerIndex(wild4Player, state.direction, players.length);
      const drawn = drawN(4, drawPile, discardPile);
      drawPile = drawn.drawPile;
      discardPile = drawn.discardPile;
      players.splice(targetIndex, 1, {
        ...players[targetIndex],
        cards: [...players[targetIndex].cards, ...drawn.cards],
      });
      toasts.push(makeToast(`${players[targetIndex].name} draws 4 cards!`, "warning"));
      const nextPlayer = nextPlayerIndex(targetIndex, state.direction, players.length);
      set({
        players,
        drawPile,
        discardPile,
        activeColor: color,
        gamePhase: "playing",
        currentPlayer: nextPlayer,
        pendingWild4Player: null,
        wild4PlayerHandAtPlay: [],
        aiThinking: false,
        toasts,
      });
      if (!players[nextPlayer].isHuman) scheduleAiTurn();
    } else {
      // Regular wild — advance to next player
      const nextPlayer = nextPlayerIndex(state.currentPlayer, state.direction, players.length);
      set({
        players,
        drawPile,
        discardPile,
        activeColor: color,
        gamePhase: "playing",
        currentPlayer: nextPlayer,
        pendingWild4Player: null,
        wild4PlayerHandAtPlay: [],
        aiThinking: false,
        toasts,
      });
      if (!players[nextPlayer].isHuman) scheduleAiTurn();
    }
  },

  // ── challengeWild4 ────────────────────────────────────────────
  challengeWild4: (doChallenge) => {
    const state = get();
    if (state.gamePhase !== "challenge") return;
    if (state.pendingWild4Player === null) return;

    const wild4Player = state.pendingWild4Player;
    const players = [...state.players];
    let drawPile = [...state.drawPile];
    let discardPile = [...state.discardPile];
    const toasts: Toast[] = [...state.toasts];

    if (!doChallenge) {
      // Human accepts the wild4 — pick color next
      set({ gamePhase: "pickColor" });
      return;
    }

    // ── Challenge: did wild4 player have a legal card? ──
    const colorBeforeWild4 = state.activeColor;
    const wild4HandAtPlay = state.wild4PlayerHandAtPlay;
    const challengeSucceeds = !playerHadNoColor(wild4HandAtPlay, colorBeforeWild4);
    const { playerDraws, challengerDraws } = resolveChallenge(challengeSucceeds);

    if (challengeSucceeds) {
      // Wild4 player was cheating → wild4 player draws 4
      const drawn = drawN(playerDraws, drawPile, discardPile);
      drawPile = drawn.drawPile;
      discardPile = drawn.discardPile;
      players.splice(wild4Player, 1, {
        ...players[wild4Player],
        cards: [...players[wild4Player].cards, ...drawn.cards],
      });
      toasts.push(makeToast(`Challenge succeeded! ${players[wild4Player].name} draws ${playerDraws} cards! 🎉`, "success"));
      // Human (challenger) doesn't draw — advance to human's turn
      const humanIndex = players.findIndex((p) => p.isHuman);
      set({
        players,
        drawPile,
        discardPile,
        gamePhase: "playing",
        currentPlayer: humanIndex,
        pendingWild4Player: null,
        wild4PlayerHandAtPlay: [],
        toasts,
      });
    } else {
      // Challenge fails → challenger (human) draws 6
      const humanIndex = players.findIndex((p) => p.isHuman);
      const drawn = drawN(challengerDraws, drawPile, discardPile);
      drawPile = drawn.drawPile;
      discardPile = drawn.discardPile;
      players.splice(humanIndex, 1, {
        ...players[humanIndex],
        cards: [...players[humanIndex].cards, ...drawn.cards],
      });
      toasts.push(makeToast(`Challenge failed! You draw ${challengerDraws} cards! 😬`, "error"));
      // Wild4 player picks color (AI)
      set({
        players,
        drawPile,
        discardPile,
        gamePhase: "pickColor",
        pendingWild4Player: wild4Player,
        toasts,
      });
      // AI picks color after a short delay
      setTimeout(() => {
        const s = useGameStore.getState();
        if (s.gamePhase === "pickColor" && s.pendingWild4Player !== null) {
          const aiPlayer = s.players[wild4Player];
          if (aiPlayer && !aiPlayer.isHuman) {
            import("@/lib/ai").then(({ computeAiAction }) => {
              const topCard = s.discardPile[s.discardPile.length - 1];
              const action = computeAiAction(aiPlayer, topCard, null, s.players.find(p => p.isHuman)?.cards.length ?? 7, s.difficulty);
              const color = action.type === "play" && action.color ? action.color : "red";
              s.pickColor(color);
            });
          }
        }
      }, 800);
    }
  },

  // ── resetGame ─────────────────────────────────────────────────
  resetGame: () => {
    set({
      players: [],
      currentPlayer: 0,
      drawPile: [],
      discardPile: [],
      direction: 1,
      activeColor: null,
      gamePhase: "idle",
      winner: null,
      roundScores: {},
      unoCallWindow: false,
      pendingWild4Player: null,
      wild4PlayerHandAtPlay: [],
      drawnCard: null,
      lastPlayedCard: null,
      aiThinking: false,
      toasts: [],
    });
  },

  // ── dismissToast ──────────────────────────────────────────────
  dismissToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

// ─────────────────────────────────────────────────────────────────
// AI scheduler
// ─────────────────────────────────────────────────────────────────

function scheduleAiTurn() {
  const delay = 900 + Math.random() * 700;
  setTimeout(async () => {
    const state = useGameStore.getState();
    if (state.gamePhase !== "playing") return;
    const idx = state.currentPlayer;
    const player = state.players[idx];
    if (!player || player.isHuman) return;

    useGameStore.setState({ aiThinking: true });

    const topCard = state.discardPile[state.discardPile.length - 1];
    const opponent = state.players.find((p) => p.isHuman);
    const opponentCardCount = opponent?.cards.length ?? 7;

    const { computeAiAction } = await import("@/lib/ai");
    const action = computeAiAction(player, topCard, state.activeColor, opponentCardCount, state.difficulty);

    useGameStore.setState({ aiThinking: false });

    if (action.type === "draw") {
      useGameStore.getState().drawCard(idx);
      // After drawing, AI always passes (no drawn-card-play option for AI UX)
      setTimeout(() => {
        const s2 = useGameStore.getState();
        if (s2.gamePhase === "drawnCard") {
          // Check if AI can play drawn card
          if (s2.drawnCard) {
            const topCard2 = s2.discardPile[s2.discardPile.length - 1];
            if (canPlayCard(s2.drawnCard, topCard2, s2.activeColor)) {
              useGameStore.getState().playDrawnCard();
              // Handle wild color pick for AI
              setTimeout(() => {
                const s3 = useGameStore.getState();
                if (s3.gamePhase === "pickColor") {
                  const aiP = s3.players[s3.currentPlayer];
                  if (aiP && !aiP.isHuman) {
                    import("@/lib/ai").then(({ computeAiAction: caa }) => {
                      const tc = s3.discardPile[s3.discardPile.length - 1];
                      const act = caa(aiP, tc, null, s3.players.find(p => p.isHuman)?.cards.length ?? 7, s3.difficulty);
                      const col = act.type === "play" && act.color ? act.color : "red";
                      useGameStore.getState().pickColor(col);
                    });
                  }
                }
              }, 400);
            } else {
              useGameStore.getState().passAfterDraw();
            }
          } else {
            useGameStore.getState().passAfterDraw();
          }
        }
      }, 500);
    } else {
      useGameStore.getState().playCard(idx, action.card.id);
      // If AI played a wild, pick color
      if (action.color) {
        setTimeout(() => {
          const s2 = useGameStore.getState();
          if (s2.gamePhase === "pickColor") {
            useGameStore.getState().pickColor(action.color!);
          }
        }, 500);
      }
    }

    // Auto-say UNO for AI
    setTimeout(() => {
      const s2 = useGameStore.getState();
      const aiPlayer = s2.players[idx];
      if (aiPlayer && aiPlayer.cards.length === 1 && !aiPlayer.saidUno) {
        useGameStore.setState({
          players: s2.players.map((p, i) =>
            i === idx ? { ...p, saidUno: true } : p
          ),
          toasts: [...s2.toasts, makeToast("AI says UNO! 🤖", "warning")],
        });
      }
    }, delay + 200);
  }, delay);
}
