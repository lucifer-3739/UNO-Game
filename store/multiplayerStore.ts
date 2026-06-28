import { create } from "zustand";
import { Card, Color, Player, GamePhase, Toast } from "@/types/uno";
import { supabase, hasSupabase } from "@/lib/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";

export interface MultiplayerPlayer {
  id: string;
  name: string;
  isHost: boolean;
  saidUno: boolean;
  cardsCount: number;
}

export interface MultiplayerGameState {
  players: MultiplayerPlayer[];
  myCards: Card[];
  currentPlayerIndex: number;
  drawPileCount: number;
  discardPile: Card[];
  direction: 1 | -1;
  activeColor: Color | null;
  winnerId: string | null;
  winnerName: string | null;
  toasts: Toast[];
  drawnCard: Card | null;

  // Connection & Room UI
  roomId: string | null;
  isHost: boolean;
  status: "idle" | "waiting" | "playing" | "finished";
  playerName: string;
  playerId: string;
  isConnecting: boolean;
  lobbyError: string | null;

  // Audio Chat
  localStream: MediaStream | null;
  isMuted: boolean;
  activePeerConnections: Record<string, RTCPeerConnection>; // playerUserId -> RTCPeerConnection
  remoteStreams: Record<string, MediaStream>; // playerUserId -> MediaStream

  // Actions
  setPlayerInfo: (name: string, id: string) => void;
  connectSocket: () => void; // Kept for compatibility, now boots DB channels
  disconnectSocket: () => void;
  createRoom: (isPrivate?: boolean) => void;
  joinRoom: (roomId: string) => void;
  matchmake: () => void;
  startGame: () => void;
  leaveRoom: () => void;

  // Game Action dispatchers
  playCard: (cardId: string, wildColor?: Color) => void;
  drawCard: () => void;
  playDrawnCard: (wildColor?: Color) => void;
  passAfterDraw: () => void;
  callUno: () => void;
  catchUno: (targetPlayerId: string) => void;

  // Audio Actions
  initAudioChat: () => Promise<void>;
  toggleMute: () => void;
  clearAudioChat: () => void;
  addToast: (message: string, type?: Toast["type"]) => void;
  dismissToast: (id: string) => void;
}

// Active channels
let dbSubscription: RealtimeChannel | null = null;
let lobbyPresenceChannel: RealtimeChannel | null = null;

// Helper to play sounds
async function playSound(fn: string, ...args: any[]) {
  if (typeof window === "undefined") return;
  try {
    const sounds = await import("@/lib/sounds");
    (sounds as any)[fn]?.(...args);
  } catch (e) {
    /* Ignore */
  }
}

// Helper to generate a deck
function generateDeck(): Card[] {
  const colors: Color[] = ["red", "blue", "green", "yellow"];
  const deck: Card[] = [];

  colors.forEach((color) => {
    deck.push({ id: `card-${color}-0-${Math.random()}`, color, value: 0 });
    for (let i = 1; i <= 9; i++) {
      for (let j = 0; j < 2; j++) {
        deck.push({ id: `card-${color}-${i}-${j}-${Math.random()}`, color, value: i });
      }
    }
    (["skip", "reverse", "draw2"] as const).forEach((action) => {
      for (let i = 0; i < 2; i++) {
        deck.push({ id: `card-${color}-${action}-${i}-${Math.random()}`, color, value: action });
      }
    });
  });

  for (let i = 0; i < 4; i++) {
    deck.push({ id: `card-wild-${i}-${Math.random()}`, color: null, value: "wild" });
    deck.push({ id: `card-wild4-${i}-${Math.random()}`, color: null, value: "wild4" });
  }

  return deck;
}

// Helper to shuffle a deck
function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Helper to draw N cards
function drawCardsFromPile(n: number, drawPile: Card[], discardPile: Card[]) {
  let dp = [...drawPile];
  let disc = [...discardPile];
  const drawn: Card[] = [];
  for (let i = 0; i < n; i++) {
    if (dp.length === 0) {
      if (disc.length <= 1) break;
      const topCard = disc[disc.length - 1];
      dp = shuffleDeck(disc.slice(0, -1));
      disc = [topCard];
    }
    if (dp.length === 0) break;
    drawn.push(dp[dp.length - 1]);
    dp = dp.slice(0, -1);
  }
  return { cards: drawn, drawPile: dp, discardPile: disc };
}

// Helper to calculate score of round
function calculateGameScore(gameState: any, winnerId: string): number {
  let score = 0;
  gameState.players.forEach((p: any) => {
    if (p.id !== winnerId) {
      p.cards.forEach((card: any) => {
        if (typeof card.value === "number") {
          score += card.value;
        } else if (card.value === "wild" || card.value === "wild4") {
          score += 50;
        } else {
          score += 20;
        }
      });
    }
  });
  return score;
}

export const useMultiplayerStore = create<MultiplayerGameState>((set, get) => ({
  players: [],
  myCards: [],
  currentPlayerIndex: 0,
  drawPileCount: 0,
  discardPile: [],
  direction: 1,
  activeColor: null,
  winnerId: null,
  winnerName: null,
  roundScore: 0,
  toasts: [],
  drawnCard: null,

  roomId: null,
  isHost: false,
  status: "idle",
  playerName: "",
  playerId: "",
  isConnecting: false,
  lobbyError: null,

  localStream: null,
  isMuted: true,
  activePeerConnections: {},
  remoteStreams: {},

  setPlayerInfo: (name, id) => {
    set({ playerName: name, playerId: id });
    if (typeof window !== "undefined") {
      localStorage.setItem("uno_local_username", name);
      localStorage.setItem("uno_local_user_id", id);
    }
  },

  connectSocket: () => {
    // Supabase Realtime is database-driven; we subscribe to rooms table changes dynamically
    if (dbSubscription) return;

    if (!hasSupabase) {
      console.warn("Supabase credentials missing. Running in local simulation mode.");
      return;
    }

    // Subscribe to Postgres changes on the 'rooms' table
    dbSubscription = supabase
      .channel("public-rooms-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rooms" },
        async (payload: any) => {
          const updatedRoom = payload.new;
          const currentRoomId = get().roomId;
          if (!updatedRoom || updatedRoom.id !== currentRoomId) return;

          const { players, status, game_state, host_id } = updatedRoom;
          const { playerId } = get();

          const isHost = host_id === playerId;
          const isGameOver = status === "finished";

          const newState: Partial<MultiplayerGameState> = {
            players,
            isHost,
            status,
          };

          if (isGameOver && game_state?.winnerId) {
            playSound("playWin");
            newState.winnerId = game_state.winnerId;
            newState.winnerName = game_state.winnerName;
            newState.roundScore = game_state.roundScore || 0;
            set(newState);

            // Handle stats upsert
            try {
              const isWinner = playerId === game_state.winnerId;
              const { data: current } = await supabase
                .from("leaderboard")
                .select("*")
                .eq("user_id", playerId)
                .maybeSingle();

              const wins = (current?.wins || 0) + (isWinner ? 1 : 0);
              const games_played = (current?.games_played || 0) + 1;
              const scoreToAdd = isWinner ? (game_state.roundScore || 100) : 10;
              const newScore = (current?.score || 0) + scoreToAdd;

              await supabase.from("leaderboard").upsert(
                {
                  user_id: playerId,
                  username: get().playerName,
                  wins,
                  games_played,
                  score: newScore,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "user_id" }
              );
            } catch (err) {
              console.error("Failed to save end game stats to Supabase:", err);
            }
            return;
          }

          if (game_state) {
            newState.currentPlayerIndex = game_state.currentPlayerIndex;
            newState.drawPileCount = game_state.drawPileCount;
            newState.discardPile = game_state.discardPile;
            newState.direction = game_state.direction;
            newState.activeColor = game_state.activeColor;
            newState.toasts = game_state.toasts || [];
            newState.drawnCard = game_state.drawnCard;

            // Trigger card sound
            const prevTopCard = get().discardPile[get().discardPile.length - 1];
            const currentTopCard = game_state.discardPile[game_state.discardPile.length - 1];
            if (currentTopCard && currentTopCard.id !== prevTopCard?.id) {
              if (currentTopCard.value === "wild" || currentTopCard.value === "wild4") {
                playSound("playWild");
              } else {
                playSound("playCardPlay", currentTopCard.color);
              }
            }

            const myPlayerState = game_state.players.find((p: any) => p.id === playerId);
            if (myPlayerState) {
              newState.myCards = myPlayerState.cards;
            }
          }

          set(newState);
        }
      )
      .subscribe();
  },

  disconnectSocket: () => {
    if (dbSubscription) {
      supabase.removeChannel(dbSubscription);
      dbSubscription = null;
    }
    get().leaveRoom();
  },

  createRoom: async (isPrivate = false) => {
    const { playerName, playerId } = get();
    const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();

    const newPlayer: MultiplayerPlayer = {
      id: playerId,
      name: playerName,
      isHost: true,
      saidUno: false,
      cardsCount: 0,
    };

    set({ isConnecting: true, lobbyError: null });

    if (hasSupabase) {
      try {
        const { error } = await supabase.from("rooms").insert({
          id: roomCode,
          host_id: playerId,
          status: "waiting",
          players: [newPlayer],
        });

        if (error) throw error;

        set({ roomId: roomCode, isHost: true, status: "waiting", players: [newPlayer], isConnecting: false });
        get().connectSocket();
        setupPresenceChannel(roomCode);
      } catch (err: any) {
        set({ isConnecting: false, lobbyError: `Failed to create room: ${err.message}` });
      }
    } else {
      // Local fallback simulation
      set({ roomId: roomCode, isHost: true, status: "waiting", players: [newPlayer], isConnecting: false });
    }
  },

  joinRoom: async (roomId) => {
    roomId = roomId.toUpperCase();
    const { playerName, playerId } = get();

    set({ isConnecting: true, lobbyError: null });

    if (hasSupabase) {
      try {
        const { data: room, error: fetchErr } = await supabase
          .from("rooms")
          .select("*")
          .eq("id", roomId)
          .maybeSingle();

        if (fetchErr) throw fetchErr;
        if (!room) {
          throw new Error("Lobby not found!");
        }

        if (room.status !== "waiting") {
          throw new Error("Game is already in progress!");
        }

        const existingPlayers: MultiplayerPlayer[] = room.players || [];
        if (existingPlayers.length >= 4 && !existingPlayers.some(p => p.id === playerId)) {
          throw new Error("Lobby is full!");
        }

        const newPlayer: MultiplayerPlayer = {
          id: playerId,
          name: playerName,
          isHost: false,
          saidUno: false,
          cardsCount: 0,
        };

        const playerIdx = existingPlayers.findIndex(p => p.id === playerId);
        let updatedPlayers = [...existingPlayers];
        if (playerIdx === -1) {
          updatedPlayers.push(newPlayer);
        } else {
          updatedPlayers[playerIdx].name = playerName; // Update nickname
        }

        const { error: updateErr } = await supabase
          .from("rooms")
          .update({ players: updatedPlayers })
          .eq("id", roomId);

        if (updateErr) throw updateErr;

        set({ roomId, isHost: room.host_id === playerId, status: "waiting", players: updatedPlayers, isConnecting: false });
        get().connectSocket();
        setupPresenceChannel(roomId);
      } catch (err: any) {
        set({ isConnecting: false, lobbyError: err.message });
      }
    } else {
      // Local Simulation
      set({ roomId, isHost: false, status: "waiting", isConnecting: false });
    }
  },

  matchmake: async () => {
    const { playerId } = get();
    set({ isConnecting: true, lobbyError: null });

    if (hasSupabase) {
      try {
        // Query database for open rooms
        const { data: openRooms } = await supabase
          .from("rooms")
          .select("*")
          .eq("status", "waiting")
          .order("created_at", { ascending: true });

        // Find a room with fewer than 4 players
        const match = openRooms?.find((r) => r.players && r.players.length < 4);

        if (match) {
          set({ isConnecting: false });
          get().joinRoom(match.id);
        } else {
          // If no rooms are open, create a new public one
          set({ isConnecting: false });
          get().createRoom(false);
        }
      } catch (err: any) {
        set({ isConnecting: false, lobbyError: `Matchmaking failed: ${err.message}` });
      }
    } else {
      set({ isConnecting: false });
      get().createRoom(false);
    }
  },

  startGame: async () => {
    const { roomId, players } = get();
    if (!roomId) return;

    if (players.length < 2) {
      set({ lobbyError: "Need at least 2 players to start!" });
      return;
    }

    let deck = shuffleDeck(generateDeck());
    const playerStates = players.map(p => {
      return {
        id: p.id,
        name: p.name,
        cards: deck.splice(0, 7),
        saidUno: false,
      };
    });

    let firstCard = deck.pop()!;
    while (firstCard.value === "wild" || firstCard.value === "wild4") {
      deck.unshift(firstCard);
      firstCard = deck.pop()!;
    }

    const gameState = {
      players: playerStates,
      currentPlayerIndex: 0,
      drawPile: deck,
      drawPileCount: deck.length,
      discardPile: [firstCard],
      direction: 1,
      activeColor: firstCard.color,
      winner: null,
      drawnCard: null,
      toasts: [{ id: "toast-start", message: `Game started! First card is ${firstCard.color || "wild"} ${firstCard.value}`, type: "info" }],
    };

    // Apply first-card actions
    if (firstCard.value === "skip") {
      gameState.currentPlayerIndex = 1 % playerStates.length;
      gameState.toasts.push({ id: "toast-skip", message: `${playerStates[0].name} is skipped!`, type: "info" });
    } else if (firstCard.value === "reverse") {
      gameState.direction = -1;
      gameState.currentPlayerIndex = (playerStates.length - 1) % playerStates.length;
      gameState.toasts.push({ id: "toast-reverse", message: "Direction reversed!", type: "info" });
    } else if (firstCard.value === "draw2") {
      const drawn = deck.splice(0, 2);
      playerStates[1 % playerStates.length].cards.push(...drawn);
      gameState.currentPlayerIndex = 2 % playerStates.length;
      gameState.toasts.push({ id: "toast-draw2", message: `${playerStates[1 % playerStates.length].name} draws 2 and is skipped!`, type: "warning" });
    }

    // Sync card counts in players list
    const updatedPlayers = players.map(p => {
      const ps = playerStates.find(ps => ps.id === p.id);
      return { ...p, cardsCount: ps ? ps.cards.length : 0 };
    });

    if (hasSupabase) {
      await supabase
        .from("rooms")
        .update({
          status: "playing",
          players: updatedPlayers,
          game_state: gameState,
        })
        .eq("id", roomId);
    }
  },

  leaveRoom: async () => {
    const { roomId, playerId, players } = get();
    if (!roomId) return;

    if (lobbyPresenceChannel) {
      supabase.removeChannel(lobbyPresenceChannel);
      lobbyPresenceChannel = null;
    }

    if (hasSupabase) {
      try {
        const remaining = players.filter(p => p.id !== playerId);
        if (remaining.length === 0) {
          // Room is empty, delete
          await supabase.from("rooms").delete().eq("id", roomId);
        } else {
          // Reassign host if necessary
          const hostId = remaining[0].id;
          remaining[0].isHost = true;

          await supabase
            .from("rooms")
            .update({
              host_id: hostId,
              players: remaining,
            })
            .eq("id", roomId);
        }
      } catch (err) {
        console.error("Failed leaving lobby database cleanup:", err);
      }
    }

    get().clearAudioChat();
    set({ roomId: null, status: "idle", players: [], myCards: [], winnerName: null, winnerId: null });
  },

  playCard: async (cardId, wildColor) => {
    const { roomId, playerId } = get();
    if (!roomId || !hasSupabase) return;

    const { data: room } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
    if (!room || !room.game_state) return;

    const gs = room.game_state;
    const playerIdx = gs.players.findIndex((p: any) => p.id === playerId);
    if (playerIdx === -1 || gs.currentPlayerIndex !== playerIdx) return;

    const playerState = gs.players[playerIdx];
    const cardIdx = playerState.cards.findIndex((c: any) => c.id === cardId);
    if (cardIdx === -1) return;

    const card = playerState.cards[cardIdx];
    playerState.cards.splice(cardIdx, 1);
    playerState.saidUno = false;
    gs.discardPile.push(card);
    gs.drawnCard = null;
    gs.toasts = [];

    // Check Win
    if (playerState.cards.length === 0) {
      gs.winnerId = playerId;
      gs.winnerName = playerState.name;
      gs.roundScore = calculateGameScore(gs, playerId);

      await supabase.from("rooms").update({
        status: "finished",
        game_state: gs,
      }).eq("id", roomId);
      return;
    }

    let nextPlayerIndexVal = (gs.currentPlayerIndex + gs.direction + gs.players.length) % gs.players.length;
    let colorToSet = card.color;
    let wild4Trigger = false;

    if (card.value === "skip") {
      nextPlayerIndexVal = (nextPlayerIndexVal + gs.direction + gs.players.length) % gs.players.length;
      gs.toasts.push({ id: `toast-${Date.now()}`, message: `${gs.players[nextPlayerIndexVal].name} is skipped!`, type: "info" });
    } else if (card.value === "reverse") {
      gs.direction = gs.direction * -1;
      if (gs.players.length === 2) {
        nextPlayerIndexVal = gs.currentPlayerIndex;
      } else {
        nextPlayerIndexVal = (gs.currentPlayerIndex + gs.direction + gs.players.length) % gs.players.length;
      }
      gs.toasts.push({ id: `toast-${Date.now()}`, message: "Direction reversed!", type: "info" });
    } else if (card.value === "draw2") {
      const drawn = drawCardsFromPile(2, gs.drawPile, gs.discardPile);
      gs.players[nextPlayerIndexVal].cards.push(...drawn.cards);
      gs.drawPile = drawn.drawPile;
      gs.discardPile = drawn.discardPile;

      gs.toasts.push({ id: `toast-${Date.now()}`, message: `${gs.players[nextPlayerIndexVal].name} draws 2 and is skipped!`, type: "warning" });
      nextPlayerIndexVal = (nextPlayerIndexVal + gs.direction + gs.players.length) % gs.players.length;
    } else if (card.value === "wild") {
      colorToSet = wildColor || "red";
    } else if (card.value === "wild4") {
      colorToSet = wildColor || "red";
      wild4Trigger = true;
    }

    gs.activeColor = colorToSet;
    gs.currentPlayerIndex = nextPlayerIndexVal;

    if (wild4Trigger) {
      const targetPlayer = gs.players[nextPlayerIndexVal];
      const drawn = drawCardsFromPile(4, gs.drawPile, gs.discardPile);
      targetPlayer.cards.push(...drawn.cards);
      gs.drawPile = drawn.drawPile;
      gs.discardPile = drawn.discardPile;
      gs.currentPlayerIndex = (nextPlayerIndexVal + gs.direction + gs.players.length) % gs.players.length;
    }

    gs.drawPileCount = gs.drawPile.length;

    // Sync counts
    const updatedPlayers = room.players.map((p: any) => {
      const ps = gs.players.find((ps: any) => ps.id === p.id);
      return { ...p, cardsCount: ps ? ps.cards.length : 0 };
    });

    await supabase.from("rooms").update({
      players: updatedPlayers,
      game_state: gs,
    }).eq("id", roomId);
  },

  drawCard: async () => {
    const { roomId, playerId } = get();
    if (!roomId || !hasSupabase) return;

    const { data: room } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
    if (!room || !room.game_state) return;

    const gs = room.game_state;
    const playerIdx = gs.players.findIndex((p: any) => p.id === playerId);
    if (playerIdx === -1 || gs.currentPlayerIndex !== playerIdx) return;

    const playerState = gs.players[playerIdx];

    const drawn = drawCardsFromPile(1, gs.drawPile, gs.discardPile);
    if (drawn.cards.length > 0) {
      const card = drawn.cards[0];
      playerState.cards.push(card);
      gs.drawPile = drawn.drawPile;
      gs.discardPile = drawn.discardPile;
      gs.drawnCard = card;
      gs.drawPileCount = gs.drawPile.length;
    }

    gs.toasts = [];

    // Auto-pass if the drawn card is not playable
    const topCard = gs.discardPile[gs.discardPile.length - 1];
    const activeColor = gs.activeColor || topCard.color;
    const card = gs.drawnCard;
    const isPlayable = card && (card.value === "wild" || card.value === "wild4" || card.color === activeColor || card.value === topCard.value);

    if (!isPlayable) {
      gs.drawnCard = null;
      gs.currentPlayerIndex = (gs.currentPlayerIndex + gs.direction + gs.players.length) % gs.players.length;
      gs.toasts.push({ id: `toast-${Date.now()}`, message: `${playerState.name} drew a card and passed.`, type: "info" });
    }

    const updatedPlayers = room.players.map((p: any) => {
      const ps = gs.players.find((ps: any) => ps.id === p.id);
      return { ...p, cardsCount: ps ? ps.cards.length : 0 };
    });

    await supabase.from("rooms").update({
      players: updatedPlayers,
      game_state: gs,
    }).eq("id", roomId);
  },

  playDrawnCard: async (wildColor) => {
    const { roomId, playerId } = get();
    if (!roomId || !hasSupabase) return;

    const { data: room } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
    if (!room || !room.game_state || !room.game_state.drawnCard) return;

    const gs = room.game_state;
    const playerIdx = gs.players.findIndex((p: any) => p.id === playerId);
    if (playerIdx === -1 || gs.currentPlayerIndex !== playerIdx) return;

    const playerState = gs.players[playerIdx];
    const card = gs.drawnCard;

    const cardIdx = playerState.cards.findIndex((c: any) => c.id === card.id);
    if (cardIdx !== -1) {
      playerState.cards.splice(cardIdx, 1);
      playerState.saidUno = false;
      gs.discardPile.push(card);
      gs.drawnCard = null;

      // Check Win
      if (playerState.cards.length === 0) {
        gs.winnerId = playerId;
        gs.winnerName = playerState.name;
        gs.roundScore = calculateGameScore(gs, playerId);

        await supabase.from("rooms").update({
          status: "finished",
          game_state: gs,
        }).eq("id", roomId);
        return;
      }

      let nextPlayerIndexVal = (gs.currentPlayerIndex + gs.direction + gs.players.length) % gs.players.length;
      let colorToSet = card.color;
      let wild4Trigger = false;

      if (card.value === "skip") {
        nextPlayerIndexVal = (nextPlayerIndexVal + gs.direction + gs.players.length) % gs.players.length;
      } else if (card.value === "reverse") {
        gs.direction = gs.direction * -1;
        if (gs.players.length === 2) {
          nextPlayerIndexVal = gs.currentPlayerIndex;
        } else {
          nextPlayerIndexVal = (gs.currentPlayerIndex + gs.direction + gs.players.length) % gs.players.length;
        }
      } else if (card.value === "draw2") {
        const drawn = drawCardsFromPile(2, gs.drawPile, gs.discardPile);
        gs.players[nextPlayerIndexVal].cards.push(...drawn.cards);
        gs.drawPile = drawn.drawPile;
        gs.discardPile = drawn.discardPile;
        nextPlayerIndexVal = (nextPlayerIndexVal + gs.direction + gs.players.length) % gs.players.length;
      } else if (card.value === "wild") {
        colorToSet = wildColor || "red";
      } else if (card.value === "wild4") {
        colorToSet = wildColor || "red";
        wild4Trigger = true;
      }

      gs.activeColor = colorToSet;
      gs.currentPlayerIndex = nextPlayerIndexVal;

      if (wild4Trigger) {
        const targetPlayer = gs.players[nextPlayerIndexVal];
        const drawn = drawCardsFromPile(4, gs.drawPile, gs.discardPile);
        targetPlayer.cards.push(...drawn.cards);
        gs.drawPile = drawn.drawPile;
        gs.discardPile = drawn.discardPile;
        gs.currentPlayerIndex = (nextPlayerIndexVal + gs.direction + gs.players.length) % gs.players.length;
      }

      gs.drawPileCount = gs.drawPile.length;
      gs.toasts = [{ id: `toast-${Date.now()}`, message: `${playerState.name} played the drawn card!`, type: "success" }];
    }

    const updatedPlayers = room.players.map((p: any) => {
      const ps = gs.players.find((ps: any) => ps.id === p.id);
      return { ...p, cardsCount: ps ? ps.cards.length : 0 };
    });

    await supabase.from("rooms").update({
      players: updatedPlayers,
      game_state: gs,
    }).eq("id", roomId);
  },

  passAfterDraw: async () => {
    const { roomId, playerId } = get();
    if (!roomId || !hasSupabase) return;

    const { data: room } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
    if (!room || !room.game_state) return;

    const gs = room.game_state;
    const playerIdx = gs.players.findIndex((p: any) => p.id === playerId);
    if (playerIdx === -1 || gs.currentPlayerIndex !== playerIdx) return;

    gs.drawnCard = null;
    gs.currentPlayerIndex = (gs.currentPlayerIndex + gs.direction + gs.players.length) % gs.players.length;
    gs.toasts = [{ id: `toast-${Date.now()}`, message: `${gs.players[playerIdx].name} passed.`, type: "info" }];

    await supabase.from("rooms").update({
      game_state: gs,
    }).eq("id", roomId);
  },

  callUno: async () => {
    const { roomId, playerId } = get();
    if (!roomId || !hasSupabase) return;

    const { data: room } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
    if (!room || !room.game_state) return;

    const gs = room.game_state;
    const playerIdx = gs.players.findIndex((p: any) => p.id === playerId);
    if (playerIdx === -1) return;

    const playerState = gs.players[playerIdx];
    if (playerState.cards.length <= 2) {
      playerState.saidUno = true;
      gs.toasts = [{ id: `toast-${Date.now()}`, message: `${playerState.name} yelled UNO! 🃏`, type: "success" }];

      // Sync players list
      const updatedPlayers = room.players.map((p: any) =>
        p.id === playerId ? { ...p, saidUno: true } : p
      );

      await supabase.from("rooms").update({
        players: updatedPlayers,
        game_state: gs,
      }).eq("id", roomId);
    }
  },

  catchUno: async (targetPlayerId) => {
    const { roomId, playerId } = get();
    if (!roomId || !hasSupabase) return;

    const { data: room } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
    if (!room || !room.game_state) return;

    const gs = room.game_state;
    const playerIdx = gs.players.findIndex((p: any) => p.id === playerId);
    const targetIdx = gs.players.findIndex((p: any) => p.id === targetPlayerId);
    if (playerIdx === -1 || targetIdx === -1) return;

    const targetPlayer = gs.players[targetIdx];
    const mustPenalize = targetPlayer.cards.length === 1 && !targetPlayer.saidUno;

    if (mustPenalize) {
      const drawn = drawCardsFromPile(2, gs.drawPile, gs.discardPile);
      targetPlayer.cards.push(...drawn.cards);
      gs.drawPile = drawn.drawPile;
      gs.discardPile = drawn.discardPile;
      gs.drawPileCount = gs.drawPile.length;

      gs.toasts = [{ id: `toast-${Date.now()}`, message: `${gs.players[playerIdx].name} caught ${targetPlayer.name} forgetting UNO! +2 cards penalty.`, type: "error" }];
    } else {
      // Challenger penalty
      const challenger = gs.players[playerIdx];
      const drawn = drawCardsFromPile(2, gs.drawPile, gs.discardPile);
      challenger.cards.push(...drawn.cards);
      gs.drawPile = drawn.drawPile;
      gs.discardPile = drawn.discardPile;
      gs.drawPileCount = gs.drawPile.length;

      gs.toasts = [{ id: `toast-${Date.now()}`, message: `False UNO catch! ${challenger.name} draws 2 cards penalty.`, type: "error" }];
    }

    const updatedPlayers = room.players.map((p: any) => {
      const ps = gs.players.find((ps: any) => ps.id === p.id);
      return { ...p, cardsCount: ps ? ps.cards.length : 0, saidUno: ps ? ps.saidUno : false };
    });

    await supabase.from("rooms").update({
      players: updatedPlayers,
      game_state: gs,
    }).eq("id", roomId);
  },

  // ── WebRTC Audio Chat Actions ──
  initAudioChat: async () => {
    try {
      const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      set({ localStream, isMuted: false });

      const { activePeerConnections, players, playerId } = get();
      const track = localStream.getAudioTracks()[0];

      // Add our track to any existing peer connections (renegotiation)
      Object.entries(activePeerConnections).forEach(async ([peerPlayerId, pc]) => {
        const senders = pc.getSenders();
        const hasTrack = senders.some((s) => s.track === track);
        if (!hasTrack) {
          pc.addTrack(track, localStream);
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            lobbyPresenceChannel?.send({
              type: "broadcast",
              event: "webrtc-signal",
              payload: {
                targetPlayerId: peerPlayerId,
                senderPlayerId: playerId,
                signalData: { type: "offer", sdp: offer },
              },
            });
          } catch (e) {
            console.error("Renegotiation failed:", e);
          }
        }
      });

      // Connect WebRTC to any remaining players
      players.forEach((p) => {
        if (p.id !== playerId && !activePeerConnections[p.id]) {
          initiateCall(p.id);
        }
      });
    } catch (err) {
      console.error("Could not capture microphone for audio chat:", err);
      set({ lobbyError: "Microphone access denied. You can still play without audio chat." });
    }
  },

  toggleMute: () => {
    const { localStream, isMuted } = get();
    if (!localStream) return;

    localStream.getAudioTracks().forEach((track) => {
      track.enabled = isMuted; // Toggle mute status of stream
    });

    set({ isMuted: !isMuted });
  },

  clearAudioChat: () => {
    const { localStream, activePeerConnections } = get();

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }

    Object.values(activePeerConnections).forEach((pc) => pc.close());

    set({
      localStream: null,
      isMuted: true,
      activePeerConnections: {},
      remoteStreams: {},
    });
  },

  addToast: (message, type = "info") => {
    const id = `toast-${Math.random()}`;
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }));
  },

  dismissToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

// ── WebRTC Signaling Helpers using Supabase Realtime Broadcast ──
function createPeerConnection(targetPlayerId: string): RTCPeerConnection {
  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  });

  const localStream = useMultiplayerStore.getState().localStream;
  if (localStream) {
    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });
  }

  pc.onicecandidate = (event) => {
    const { playerId } = useMultiplayerStore.getState();
    if (event.candidate && lobbyPresenceChannel) {
      lobbyPresenceChannel.send({
        type: "broadcast",
        event: "webrtc-signal",
        payload: {
          targetPlayerId,
          senderPlayerId: playerId,
          signalData: {
            type: "ice-candidate",
            candidate: event.candidate,
          },
        },
      });
    }
  };

  pc.ontrack = (event) => {
    console.log(`Received remote track from ${targetPlayerId}`);
    const remoteStream = event.streams[0];

    if (typeof window !== "undefined") {
      const audio = document.createElement("audio");
      audio.style.display = "none";
      audio.autoplay = true;
      audio.srcObject = remoteStream;
      document.body.appendChild(audio);
      (pc as any).audioElement = audio;
    }

    setRemoteStream(targetPlayerId, remoteStream);
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "disconnected" || pc.connectionState === "failed" || pc.connectionState === "closed") {
      removePeerConnection(targetPlayerId);
    }
  };

  const pcs = { ...useMultiplayerStore.getState().activePeerConnections };
  pcs[targetPlayerId] = pc;
  useMultiplayerStore.setState({ activePeerConnections: pcs });

  return pc;
}

async function initiateCall(targetPlayerId: string) {
  const pc = createPeerConnection(targetPlayerId);
  const { playerId } = useMultiplayerStore.getState();
  if (!lobbyPresenceChannel) return;

  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    lobbyPresenceChannel.send({
      type: "broadcast",
      event: "webrtc-signal",
      payload: {
        targetPlayerId,
        senderPlayerId: playerId,
        signalData: {
          type: "offer",
          sdp: offer,
        },
      },
    });
  } catch (err) {
    console.error("Failed to generate WebRTC offer:", err);
  }
}

function setRemoteStream(playerId: string, stream: MediaStream) {
  const streams = { ...useMultiplayerStore.getState().remoteStreams };
  streams[playerId] = stream;
  useMultiplayerStore.setState({ remoteStreams: streams });
}

function removePeerConnection(playerId: string) {
  const pcs = { ...useMultiplayerStore.getState().activePeerConnections };
  const streams = { ...useMultiplayerStore.getState().remoteStreams };

  if (pcs[playerId]) {
    const audio = (pcs[playerId] as any).audioElement;
    if (audio) {
      try {
        audio.pause();
        audio.remove();
      } catch (err) {
        console.warn(err);
      }
    }
    pcs[playerId].close();
    delete pcs[playerId];
  }
  if (streams[playerId]) {
    delete streams[playerId];
  }

  useMultiplayerStore.setState({
    activePeerConnections: pcs,
    remoteStreams: streams,
  });
}

// Setup lobby channel for Presence and WebRTC signaling Broadcast
function setupPresenceChannel(roomId: string) {
  if (lobbyPresenceChannel) {
    supabase.removeChannel(lobbyPresenceChannel);
  }

  const store = useMultiplayerStore.getState();
  const channel = supabase.channel(`lobby:${roomId}`);

  lobbyPresenceChannel = channel;

  channel
    .on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const onlinePlayers = Object.values(state)
        .flat()
        .map((p: any) => p.user);

      // Sync active peer connections
      const localStream = useMultiplayerStore.getState().localStream;
      if (localStream) {
        onlinePlayers.forEach((p: any) => {
          const { playerId, activePeerConnections } = useMultiplayerStore.getState();
          if (p.id !== playerId && !activePeerConnections[p.id]) {
            initiateCall(p.id);
          }
        });
      }
    })
    .on("broadcast", { event: "webrtc-signal" }, async ({ payload }) => {
      const { playerId, activePeerConnections } = useMultiplayerStore.getState();
      const { targetPlayerId, senderPlayerId, signalData } = payload;

      if (targetPlayerId !== playerId) return;

      let pc = activePeerConnections[senderPlayerId];
      if (!pc) {
        pc = createPeerConnection(senderPlayerId);
      }

      try {
        if (signalData.type === "offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          lobbyPresenceChannel?.send({
            type: "broadcast",
            event: "webrtc-signal",
            payload: {
              targetPlayerId: senderPlayerId,
              senderPlayerId: playerId,
              signalData: { type: "answer", sdp: answer },
            },
          });
        } else if (signalData.type === "answer") {
          await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
        } else if (signalData.type === "ice-candidate") {
          if (signalData.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
          }
        }
      } catch (err) {
        console.error("Error handling WebRTC signal broadcast:", err);
      }
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          user: {
            id: store.playerId,
            name: store.playerName,
          },
        });
      }
    });
}
