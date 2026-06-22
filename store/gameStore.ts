import { create } from "zustand";
import { Card, Color, Player, GamePhase, Difficulty } from "@/types/uno";
import { generateDeck, shuffleDeck, reshuffleDiscardIntoDraw } from "@/lib/deck";
import { canPlayCard, nextPlayerIndex, calculateScore, checkWinner } from "@/lib/gameEngine";
import { playerHadNoColor, resolveChallenge, mustPenalizeUno } from "@/lib/rules";
import { computeAiAction } from "@/lib/ai";

export interface GameState {
  // Game data
  players: Player[];
  currentPlayer: number;
  drawPile: Card[];
  discardPile: Card[];
  direction: 1 | -1;
  activeColor: Color | null;
  gamePhase: GamePhase;
  winner: string | null;
  scores: Record<string, number>;
  difficulty: Difficulty;

  // Transient UI flags
  unoCallWindow: boolean;     // true when current player just reached 1 card
  pendingWild4Player: number | null; // index of player who played wild4 (for challenge)
  lastPlayedCard: Card | null;
  aiThinking: boolean;

  // Actions
  initializeGame: (difficulty?: Difficulty) => void;
  playCard: (playerIndex: number, cardId: string) => void;
  drawCard: (playerIndex: number) => void;
  callUno: (playerIndex: number) => void;
  pickColor: (color: Color) => void;
  challengeWild4: (accept: boolean) => void;
  resetGame: () => void;
}

// Helper to draw N cards from the pile (with reshuffle if needed)
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
      const reshuffled = reshuffleDiscardIntoDraw(dp, disc);
      dp = reshuffled.drawPile;
      disc = reshuffled.discardPile;
    }
    if (dp.length === 0) break;
    drawn.push(dp[dp.length - 1]);
    dp = dp.slice(0, -1);
  }
  return { cards: drawn, drawPile: dp, discardPile: disc };
}

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
  difficulty: "medium",
  unoCallWindow: false,
  pendingWild4Player: null,
  lastPlayedCard: null,
  aiThinking: false,

  initializeGame: (difficulty = "medium") => {
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

    set({
      players: [human, ai],
      currentPlayer: 0,
      drawPile: deck,
      discardPile: [firstCard],
      direction: 1,
      activeColor: firstCard.color,
      gamePhase: "playing",
      winner: null,
      difficulty,
      unoCallWindow: false,
      pendingWild4Player: null,
      lastPlayedCard: firstCard,
      aiThinking: false,
    });
  },

  playCard: (playerIndex, cardId) => {
    const state = get();
    if (state.gamePhase !== "playing") return;
    if (state.currentPlayer !== playerIndex) return;

    const player = state.players[playerIndex];
    const card = player.cards.find((c) => c.id === cardId);
    if (!card) return;

    const topCard = state.discardPile[state.discardPile.length - 1];
    if (!canPlayCard(card, topCard, state.activeColor)) return;

    // Check if this player forgot UNO on previous turn (they had 1 card, didn't call it)
    // This would be caught by drawCard triggering the penalty window

    const players = state.players.map((p, i) =>
      i === playerIndex
        ? { ...p, cards: p.cards.filter((c) => c.id !== cardId), saidUno: false }
        : p
    );

    const newDiscardPile = [...state.discardPile, card];

    // Check for win
    if (players[playerIndex].cards.length === 0) {
      const score = calculateScore(
        players.filter((_, i) => i !== playerIndex)
      );
      set({
        players,
        discardPile: newDiscardPile,
        lastPlayedCard: card,
        gamePhase: "won",
        winner: player.name,
        scores: {
          ...state.scores,
          [player.id]: (state.scores[player.id] ?? 0) + score,
        },
      });
      return;
    }

    // Detect UNO window (player just reached 1 card)
    const unoCallWindow =
      players[playerIndex].cards.length === 1 && player.isHuman;

    // Apply card effects
    let direction = state.direction;
    let nextPlayer = nextPlayerIndex(
      playerIndex,
      direction,
      players.length
    );
    let newGamePhase: GamePhase = "playing";
    let drawPile = [...state.drawPile];
    let discardPile = newDiscardPile;
    let pendingWild4Player: number | null = null;

    if (card.value === "reverse") {
      direction = (direction * -1) as 1 | -1;
      // With 2 players, reverse acts like skip
      nextPlayer = nextPlayerIndex(playerIndex, direction, players.length);
    } else if (card.value === "skip") {
      nextPlayer = nextPlayerIndex(nextPlayer, direction, players.length);
    } else if (card.value === "draw2") {
      const drawn = drawN(2, drawPile, discardPile);
      drawPile = drawn.drawPile;
      discardPile = drawn.discardPile;
      const draw2Target = nextPlayer;
      players.splice(draw2Target, 1, {
        ...players[draw2Target],
        cards: [...players[draw2Target].cards, ...drawn.cards],
      });
      nextPlayer = nextPlayerIndex(nextPlayer, direction, players.length);
    } else if (card.value === "wild") {
      newGamePhase = "pickColor";
      nextPlayer = playerIndex; // stay until color picked
    } else if (card.value === "wild4") {
      newGamePhase = "pickColor"; // pick color first, then handle draw
      pendingWild4Player = playerIndex;
      nextPlayer = playerIndex; // stay until color picked
    }

    const activeColor =
      card.color ??
      (card.value === "wild" || card.value === "wild4" ? null : state.activeColor);

    set({
      players,
      discardPile,
      drawPile,
      direction,
      activeColor,
      currentPlayer: nextPlayer,
      gamePhase: newGamePhase,
      unoCallWindow,
      pendingWild4Player,
      lastPlayedCard: card,
      aiThinking: false,
    });

    // Schedule AI turn if next is AI and game is still playing
    if (newGamePhase === "playing" && !players[nextPlayer].isHuman) {
      scheduleAiTurn();
    }
  },

  drawCard: (playerIndex) => {
    const state = get();
    if (state.gamePhase !== "playing") return;
    if (state.currentPlayer !== playerIndex) return;

    // Check for UNO penalty: if this player had 1 card and didn't say UNO
    // before drawing (edge case — normally they can't draw if they have a playable card)
    const player = state.players[playerIndex];
    if (mustPenalizeUno(player)) {
      // Draw 2 penalty cards on top of the 1 they're about to draw
      const penaltyDraw = drawN(2, state.drawPile, state.discardPile);
      const mainDraw = drawN(1, penaltyDraw.drawPile, penaltyDraw.discardPile);
      const updatedPlayers = state.players.map((p, i) =>
        i === playerIndex
          ? { ...p, cards: [...p.cards, ...penaltyDraw.cards, ...mainDraw.cards], saidUno: false }
          : p
      );
      const nextPlayer = nextPlayerIndex(playerIndex, state.direction, updatedPlayers.length);
      set({
        players: updatedPlayers,
        drawPile: mainDraw.drawPile,
        discardPile: mainDraw.discardPile,
        currentPlayer: nextPlayer,
        unoCallWindow: false,
      });
      if (!updatedPlayers[nextPlayer].isHuman) scheduleAiTurn();
      return;
    }

    const drawn = drawN(1, state.drawPile, state.discardPile);
    if (drawn.cards.length === 0) return;

    const updatedPlayers = state.players.map((p, i) =>
      i === playerIndex
        ? { ...p, cards: [...p.cards, ...drawn.cards] }
        : p
    );

    const nextPlayer = nextPlayerIndex(playerIndex, state.direction, updatedPlayers.length);

    set({
      players: updatedPlayers,
      drawPile: drawn.drawPile,
      discardPile: drawn.discardPile,
      currentPlayer: nextPlayer,
      unoCallWindow: false,
    });

    if (!updatedPlayers[nextPlayer].isHuman) scheduleAiTurn();
  },

  callUno: (playerIndex) => {
    set((state) => ({
      players: state.players.map((p, i) =>
        i === playerIndex ? { ...p, saidUno: true } : p
      ),
      unoCallWindow: false,
    }));
  },

  pickColor: (color) => {
    const state = get();
    if (state.gamePhase !== "pickColor") return;

    const players = [...state.players];
    let drawPile = [...state.drawPile];
    let discardPile = [...state.discardPile];
    const wild4Player = state.pendingWild4Player;

    if (wild4Player !== null) {
      // Wild Draw Four: next player (in current direction) draws 4
      const targetIndex = nextPlayerIndex(
        wild4Player,
        state.direction,
        players.length
      );
      const drawn = drawN(4, drawPile, discardPile);
      drawPile = drawn.drawPile;
      discardPile = drawn.discardPile;
      players[targetIndex] = {
        ...players[targetIndex],
        cards: [...players[targetIndex].cards, ...drawn.cards],
      };
      const nextPlayer = nextPlayerIndex(targetIndex, state.direction, players.length);
      set({
        players,
        drawPile,
        discardPile,
        activeColor: color,
        gamePhase: "playing",
        currentPlayer: nextPlayer,
        pendingWild4Player: null,
        aiThinking: false,
      });
      if (!players[nextPlayer].isHuman) scheduleAiTurn();
    } else {
      // Regular wild
      const currentPlayer = state.currentPlayer;
      const nextPlayer = nextPlayerIndex(currentPlayer, state.direction, players.length);
      set({
        players,
        drawPile,
        discardPile,
        activeColor: color,
        gamePhase: "playing",
        currentPlayer: nextPlayer,
        pendingWild4Player: null,
        aiThinking: false,
      });
      if (!players[nextPlayer].isHuman) scheduleAiTurn();
    }
  },

  challengeWild4: (accept) => {
    // accept = true means challenger accepts (no challenge), false means challenge
    const state = get();
    if (state.pendingWild4Player === null) return;
    // This is a simplified challenge flow — challenge modal shown to human
    // In pickColor flow the Wild4 draw already happened in pickColor
    // so challengeWild4 is for future expansion
    set({ gamePhase: "playing" });
  },

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
      unoCallWindow: false,
      pendingWild4Player: null,
      lastPlayedCard: null,
      aiThinking: false,
    });
  },
}));

// AI turn scheduler — runs outside Zustand to allow delay
function scheduleAiTurn() {
  const delay = 800 + Math.random() * 600;
  setTimeout(() => {
    const state = useGameStore.getState();
    if (state.gamePhase !== "playing") return;
    const currentPlayer = state.currentPlayer;
    const player = state.players[currentPlayer];
    if (!player || player.isHuman) return;

    useGameStore.setState({ aiThinking: true });

    const topCard = state.discardPile[state.discardPile.length - 1];
    const opponent = state.players.find((p) => p.isHuman);
    const opponentCardCount = opponent?.cards.length ?? 7;

    const action = computeAiAction(
      player,
      topCard,
      state.activeColor,
      opponentCardCount,
      state.difficulty
    );

    useGameStore.setState({ aiThinking: false });

    if (action.type === "draw") {
      useGameStore.getState().drawCard(currentPlayer);
    } else {
      useGameStore.getState().playCard(currentPlayer, action.card.id);
      // If AI played a wild, immediately pick the best color
      if (action.color) {
        setTimeout(() => {
          useGameStore.getState().pickColor(action.color!);
        }, 400);
      }
    }

    // Check if AI needs to say UNO
    const newState = useGameStore.getState();
    const aiPlayer = newState.players[currentPlayer];
    if (aiPlayer && aiPlayer.cards.length === 1 && !aiPlayer.saidUno) {
      useGameStore.setState({
        players: newState.players.map((p, i) =>
          i === currentPlayer ? { ...p, saidUno: true } : p
        ),
      });
    }
  }, delay);
}
