const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");
const { createClient } = require("@supabase/supabase-js");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Setup Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const hasSupabase = Boolean(supabaseUrl && supabaseAnonKey);
const supabase = hasSupabase ? createClient(supabaseUrl, supabaseAnonKey) : null;

// Game Room store in server memory
const rooms = new Map();

// Helper to generate unique room code
function generateRoomCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code;
  do {
    code = "";
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (rooms.has(code));
  return code;
}

// Helper to generate a standard UNO deck
function generateDeck() {
  const colors = ["red", "blue", "green", "yellow"];
  const deck = [];

  colors.forEach((color) => {
    deck.push({ id: `card-${color}-0-${Math.random()}`, color, value: 0 });
    for (let i = 1; i <= 9; i++) {
      for (let j = 0; j < 2; j++) {
        deck.push({ id: `card-${color}-${i}-${j}-${Math.random()}`, color, value: i });
      }
    }
    ["skip", "reverse", "draw2"].forEach((action) => {
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
function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Helper to calculate total score of a game when someone wins
function calculateGameScore(gameState, winnerId) {
  let score = 0;
  gameState.players.forEach((p) => {
    if (p.id !== winnerId) {
      p.cards.forEach((card) => {
        if (typeof card.value === "number") {
          score += card.value;
        } else if (card.value === "wild" || card.value === "wild4") {
          score += 50;
        } else {
          score += 20; // skip, reverse, draw2
        }
      });
    }
  });
  return score;
}

// Sync room to Supabase DB
async function syncRoomToSupabase(roomId, roomData) {
  if (!supabase) return;
  try {
    const { error } = await supabase.from("rooms").upsert({
      id: roomId,
      host_id: roomData.hostId,
      status: roomData.status,
      players: roomData.players,
      game_state: roomData.gameState || null,
      updated_at: new Date().toISOString()
    });
    if (error) console.error("Error syncing room to Supabase:", error.message);
  } catch (err) {
    console.error("Supabase sync exception:", err);
  }
}

// Delete room from Supabase DB
async function deleteRoomFromSupabase(roomId) {
  if (!supabase) return;
  try {
    const { error } = await supabase.from("rooms").delete().eq("id", roomId);
    if (error) console.error("Error deleting room from Supabase:", error.message);
  } catch (err) {
    console.error("Supabase delete exception:", err);
  }
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Matchmaking Request
    socket.on("matchmake", async ({ playerName, playerId }) => {
      let matchedRoomId = null;

      // Find an open, non-full room in memory
      for (const [roomId, room] of rooms.entries()) {
        if (room.status === "waiting" && room.players.length < 4 && !room.isPrivate) {
          matchedRoomId = roomId;
          break;
        }
      }

      // If no room found, create a public room
      if (!matchedRoomId) {
        matchedRoomId = generateRoomCode();
        rooms.set(matchedRoomId, {
          id: matchedRoomId,
          hostId: playerId,
          status: "waiting",
          players: [],
          isPrivate: false,
          gameState: null,
        });
      }

      socket.emit("matchmake-result", { roomId: matchedRoomId });
    });

    // Join Room
    socket.on("join-room", async ({ roomId, playerName, playerId, isPrivate = false }) => {
      roomId = roomId.toUpperCase();
      let room = rooms.get(roomId);

      if (!room) {
        // Create new room if it doesn't exist
        room = {
          id: roomId,
          hostId: playerId,
          status: "waiting",
          players: [],
          isPrivate: isPrivate,
          gameState: null,
        };
        rooms.set(roomId, room);
      }

      // Check if room is full
      if (room.players.length >= 4 && !room.players.some(p => p.id === playerId)) {
        socket.emit("join-error", { message: "Room is full!" });
        return;
      }

      // Add player if not already in
      const existingPlayer = room.players.find(p => p.id === playerId);
      if (!existingPlayer) {
        room.players.push({
          id: playerId,
          name: playerName,
          socketId: socket.id,
          isHost: room.hostId === playerId,
          saidUno: false,
          cardsCount: 0,
        });
      } else {
        // Update socket ID
        existingPlayer.socketId = socket.id;
        existingPlayer.name = playerName;
      }

      socket.join(roomId);
      socket.roomId = roomId;
      socket.playerId = playerId;

      console.log(`Player ${playerName} (${playerId}) joined room ${roomId}`);

      // Sync and broadcast
      await syncRoomToSupabase(roomId, room);
      io.to(roomId).emit("room-updated", {
        roomId,
        players: room.players,
        hostId: room.hostId,
        status: room.status,
        gameState: room.gameState ? sanitizeGameState(room.gameState, playerId) : null,
      });
    });

    // Start Game
    socket.on("start-game", async ({ roomId }) => {
      const room = rooms.get(roomId);
      if (!room) return;

      if (room.players.length < 2) {
        socket.emit("game-error", { message: "Need at least 2 players to start!" });
        return;
      }

      // Initialize game state
      let deck = shuffleDeck(generateDeck());
      const playerStates = room.players.map(p => {
        return {
          id: p.id,
          name: p.name,
          socketId: p.socketId,
          cards: deck.splice(0, 7),
          saidUno: false,
        };
      });

      // Get first card (must not be wild)
      let firstCard = deck.pop();
      while (firstCard.value === "wild" || firstCard.value === "wild4") {
        deck.unshift(firstCard);
        firstCard = deck.pop();
      }

      room.status = "playing";
      room.gameState = {
        players: playerStates,
        currentPlayerIndex: 0,
        drawPile: deck,
        discardPile: [firstCard],
        direction: 1,
        activeColor: firstCard.color,
        winner: null,
        drawnCard: null,
        pendingWild4PlayerIndex: null,
        wild4PlayerHandAtPlay: [],
        toasts: [{ id: "toast-start", message: `Game started! First card is ${firstCard.color || "wild"} ${firstCard.value}`, type: "info" }],
      };

      // Apply initial card actions
      if (firstCard.value === "skip") {
        room.gameState.currentPlayerIndex = 1 % playerStates.length;
        room.gameState.toasts.push({ id: "toast-skip", message: `${playerStates[0].name} is skipped!`, type: "info" });
      } else if (firstCard.value === "reverse") {
        room.gameState.direction = -1;
        room.gameState.currentPlayerIndex = (playerStates.length - 1) % playerStates.length;
        room.gameState.toasts.push({ id: "toast-reverse", message: "Direction reversed!", type: "info" });
      } else if (firstCard.value === "draw2") {
        // Next player draws 2 cards and turn is skipped
        const nextIdx = 1 % playerStates.length;
        const drawnCards = deck.splice(0, 2);
        playerStates[nextIdx].cards.push(...drawnCards);
        room.gameState.currentPlayerIndex = (2 % playerStates.length);
        room.gameState.toasts.push({ id: "toast-draw2", message: `${playerStates[nextIdx].name} draws 2 and is skipped!`, type: "warning" });
      }

      // Update player card counts for lobby view
      room.players.forEach(p => {
        const pState = playerStates.find(ps => ps.id === p.id);
        p.cardsCount = pState ? pState.cards.length : 0;
      });

      await syncRoomToSupabase(roomId, room);

      // Broadcast game state to each player, hidden other players' cards
      room.players.forEach(p => {
        io.to(p.socketId).emit("game-started", {
          roomId,
          status: room.status,
          gameState: sanitizeGameState(room.gameState, p.id),
          players: room.players,
        });
      });
    });

    // Game Actions
    socket.on("game-action", async ({ roomId, action, data }) => {
      const room = rooms.get(roomId);
      if (!room || !room.gameState) return;

      const gs = room.gameState;
      const playerIndex = gs.players.findIndex(p => p.id === socket.playerId);
      if (playerIndex === -1) return;

      const currentPlayer = gs.players[gs.currentPlayerIndex];
      const isMyTurn = currentPlayer.id === socket.playerId;

      if (action === "play-card") {
        if (!isMyTurn) return;
        const { cardId, wildColor } = data;
        const playerState = gs.players[playerIndex];
        const cardIdx = playerState.cards.findIndex(c => c.id === cardId);
        if (cardIdx === -1) return;

        const card = playerState.cards[cardIdx];
        const topCard = gs.discardPile[gs.discardPile.length - 1];

        // Validate card eligibility
        const activeColor = gs.activeColor || topCard.color;
        const isPlayable = card.value === "wild" || card.value === "wild4" || card.color === activeColor || card.value === topCard.value;
        if (!isPlayable) return;

        // Remove card from hand
        playerState.cards.splice(cardIdx, 1);
        playerState.saidUno = false; // Reset Uno status after play
        gs.discardPile.push(card);
        gs.drawnCard = null;

        // Reset toasts
        gs.toasts = [];

        // Check for Win
        if (playerState.cards.length === 0) {
          gs.winner = playerState.name;
          room.status = "finished";
          const score = calculateGameScore(gs, playerState.id);
          io.to(roomId).emit("game-over", { winnerName: playerState.name, winnerId: playerState.id, score });
          await syncRoomToSupabase(roomId, room);
          return;
        }

        // Card Effects
        let nextPlayerIndexVal = (gs.currentPlayerIndex + gs.direction + gs.players.length) % gs.players.length;
        let colorToSet = card.color;
        let wild4Trigger = false;

        if (card.value === "skip") {
          nextPlayerIndexVal = (nextPlayerIndexVal + gs.direction + gs.players.length) % gs.players.length;
          gs.toasts.push({ id: `toast-skip-${Date.now()}`, message: `${gs.players[nextPlayerIndexVal].name} is skipped!`, type: "info" });
        } else if (card.value === "reverse") {
          gs.direction = gs.direction * -1;
          if (gs.players.length === 2) {
            nextPlayerIndexVal = gs.currentPlayerIndex; // Skip opponent in 2 player
          } else {
            nextPlayerIndexVal = (gs.currentPlayerIndex + gs.direction + gs.players.length) % gs.players.length;
          }
          gs.toasts.push({ id: `toast-rev-${Date.now()}`, message: "Direction reversed!", type: "info" });
        } else if (card.value === "draw2") {
          const drawn = drawCardsFromPile(2, gs.drawPile, gs.discardPile);
          gs.players[nextPlayerIndexVal].cards.push(...drawn.cards);
          gs.drawPile = drawn.drawPile;
          gs.discardPile = drawn.discardPile;

          gs.toasts.push({ id: `toast-d2-${Date.now()}`, message: `${gs.players[nextPlayerIndexVal].name} draws 2 and is skipped!`, type: "warning" });
          nextPlayerIndexVal = (nextPlayerIndexVal + gs.direction + gs.players.length) % gs.players.length;
        } else if (card.value === "wild") {
          colorToSet = wildColor;
          gs.toasts.push({ id: `toast-wild-${Date.now()}`, message: `${playerState.name} chose color ${wildColor}!`, type: "info" });
        } else if (card.value === "wild4") {
          colorToSet = wildColor;
          gs.pendingWild4PlayerIndex = playerIndex;
          gs.wild4PlayerHandAtPlay = [...playerState.cards];
          wild4Trigger = true;
          gs.toasts.push({ id: `toast-wild4-${Date.now()}`, message: `${playerState.name} played Wild Draw 4! Color: ${wildColor}`, type: "warning" });
        }

        gs.activeColor = colorToSet;
        gs.currentPlayerIndex = nextPlayerIndexVal;

        // Apply Draw 4 if not challenged (simplified: auto apply if next player does not challenge or auto apply directly)
        if (wild4Trigger) {
          // By default, apply immediately unless challenged. Let's give client 5s to challenge or auto apply.
          // For simplicity in sync, next player gets Wild 4 draw instantly unless they send a challenge action
          const targetPlayer = gs.players[nextPlayerIndexVal];
          const drawn = drawCardsFromPile(4, gs.drawPile, gs.discardPile);
          targetPlayer.cards.push(...drawn.cards);
          gs.drawPile = drawn.drawPile;
          gs.discardPile = drawn.discardPile;
          gs.currentPlayerIndex = (nextPlayerIndexVal + gs.direction + gs.players.length) % gs.players.length;
          gs.pendingWild4PlayerIndex = null;
        }

        // Sync card counts
        room.players.forEach(p => {
          const ps = gs.players.find(ps => ps.id === p.id);
          p.cardsCount = ps ? ps.cards.length : 0;
        });

        await syncRoomToSupabase(roomId, room);
        broadcastGameState(room);
      }

      else if (action === "draw-card") {
        if (!isMyTurn) return;
        const playerState = gs.players[playerIndex];

        // Draw 1 card
        const drawn = drawCardsFromPile(1, gs.drawPile, gs.discardPile);
        if (drawn.cards.length > 0) {
          const card = drawn.cards[0];
          playerState.cards.push(card);
          gs.drawPile = drawn.drawPile;
          gs.discardPile = drawn.discardPile;
          gs.drawnCard = card;
        }

        // Reset toasts
        gs.toasts = [];

        // Check if drawn card is playable
        const topCard = gs.discardPile[gs.discardPile.length - 1];
        const activeColor = gs.activeColor || topCard.color;
        const card = gs.drawnCard;
        const isPlayable = card && (card.value === "wild" || card.value === "wild4" || card.color === activeColor || card.value === topCard.value);

        if (!isPlayable) {
          // Automatically pass if not playable
          gs.drawnCard = null;
          gs.currentPlayerIndex = (gs.currentPlayerIndex + gs.direction + gs.players.length) % gs.players.length;
          gs.toasts.push({ id: `toast-draw-${Date.now()}`, message: `${playerState.name} drew a card and passed.`, type: "info" });
        }

        // Sync card counts
        room.players.forEach(p => {
          const ps = gs.players.find(ps => ps.id === p.id);
          p.cardsCount = ps ? ps.cards.length : 0;
        });

        await syncRoomToSupabase(roomId, room);
        broadcastGameState(room);
      }

      else if (action === "play-drawn") {
        if (!isMyTurn || !gs.drawnCard) return;
        const playerState = gs.players[playerIndex];
        const card = gs.drawnCard;

        // Perform play card action for drawn card
        const cardId = card.id;
        const { wildColor } = data;

        const cardIdx = playerState.cards.findIndex(c => c.id === cardId);
        if (cardIdx !== -1) {
          playerState.cards.splice(cardIdx, 1);
          playerState.saidUno = false;
          gs.discardPile.push(card);
          gs.drawnCard = null;

          // Check Win
          if (playerState.cards.length === 0) {
            gs.winner = playerState.name;
            room.status = "finished";
            const score = calculateGameScore(gs, playerState.id);
            io.to(roomId).emit("game-over", { winnerName: playerState.name, winnerId: playerState.id, score });
            await syncRoomToSupabase(roomId, room);
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
            colorToSet = wildColor;
          } else if (card.value === "wild4") {
            colorToSet = wildColor;
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

          gs.toasts = [{ id: `toast-play-drawn-${Date.now()}`, message: `${playerState.name} played drawn card!`, type: "success" }];
        }

        room.players.forEach(p => {
          const ps = gs.players.find(ps => ps.id === p.id);
          p.cardsCount = ps ? ps.cards.length : 0;
        });

        await syncRoomToSupabase(roomId, room);
        broadcastGameState(room);
      }

      else if (action === "pass") {
        if (!isMyTurn || !gs.drawnCard) return;
        const playerState = gs.players[playerIndex];
        gs.drawnCard = null;
        gs.currentPlayerIndex = (gs.currentPlayerIndex + gs.direction + gs.players.length) % gs.players.length;

        gs.toasts = [{ id: `toast-pass-${Date.now()}`, message: `${playerState.name} passed.`, type: "info" }];

        await syncRoomToSupabase(roomId, room);
        broadcastGameState(room);
      }

      else if (action === "call-uno") {
        const playerState = gs.players[playerIndex];
        if (playerState.cards.length <= 2) {
          playerState.saidUno = true;
          gs.toasts = [{ id: `toast-uno-${Date.now()}`, message: `${playerState.name} yelled UNO! 🃏`, type: "success" }];
          broadcastGameState(room);
        }
      }

      else if (action === "catch-uno") {
        const { targetPlayerId } = data;
        const targetIndexVal = gs.players.findIndex(p => p.id === targetPlayerId);
        if (targetIndexVal === -1) return;

        const targetPlayer = gs.players[targetIndexVal];
        const mustPenalize = targetPlayer.cards.length === 1 && !targetPlayer.saidUno;

        if (mustPenalize) {
          const drawn = drawCardsFromPile(2, gs.drawPile, gs.discardPile);
          targetPlayer.cards.push(...drawn.cards);
          gs.drawPile = drawn.drawPile;
          gs.discardPile = drawn.discardPile;

          gs.toasts = [{ id: `toast-catch-${Date.now()}`, message: `${gs.players[playerIndex].name} caught ${targetPlayer.name} forgetting UNO! +2 cards penalty.`, type: "error" }];

          room.players.forEach(p => {
            const ps = gs.players.find(ps => ps.id === p.id);
            p.cardsCount = ps ? ps.cards.length : 0;
          });

          await syncRoomToSupabase(roomId, room);
          broadcastGameState(room);
        } else {
          // False accusation penalty: challenger draws 2
          const playerState = gs.players[playerIndex];
          const drawn = drawCardsFromPile(2, gs.drawPile, gs.discardPile);
          playerState.cards.push(...drawn.cards);
          gs.drawPile = drawn.drawPile;
          gs.discardPile = drawn.discardPile;

          gs.toasts = [{ id: `toast-false-catch-${Date.now()}`, message: `False UNO catch! ${playerState.name} draws 2 cards penalty.`, type: "error" }];

          room.players.forEach(p => {
            const ps = gs.players.find(ps => ps.id === p.id);
            p.cardsCount = ps ? ps.cards.length : 0;
          });

          await syncRoomToSupabase(roomId, room);
          broadcastGameState(room);
        }
      }
    });

    // WebRTC signaling for audio chat
    socket.on("webrtc-signal", ({ roomId, targetSocketId, signalData }) => {
      io.to(targetSocketId).emit("webrtc-signal", {
        senderSocketId: socket.id,
        signalData,
      });
    });

    // Leave Room / Disconnect
    socket.on("leave-room", async () => {
      await handleDisconnect();
    });

    socket.on("disconnect", async () => {
      console.log(`Socket disconnected: ${socket.id}`);
      await handleDisconnect();
    });

    // Disconnect cleanup logic
    async function handleDisconnect() {
      const roomId = socket.roomId;
      const playerId = socket.playerId;
      if (!roomId) return;

      const room = rooms.get(roomId);
      if (!room) return;

      // Remove player
      room.players = room.players.filter(p => p.id !== playerId);

      // If room is empty, delete it
      if (room.players.length === 0) {
        rooms.delete(roomId);
        await deleteRoomFromSupabase(roomId);
        console.log(`Room ${roomId} is empty and deleted.`);
        return;
      }

      // If host disconnected, assign new host
      if (room.hostId === playerId) {
        room.hostId = room.players[0].id;
        room.players[0].isHost = true;
      }

      // If in game, clean up game state or pause it
      if (room.gameState) {
        room.gameState.players = room.gameState.players.filter(p => p.id !== playerId);
        // If too few players remaining, end the game
        if (room.gameState.players.length < 2 && room.status === "playing") {
          room.status = "finished";
          room.gameState.winner = room.gameState.players[0]?.name || "Remaining Player";
          io.to(roomId).emit("game-over", { winnerName: room.gameState.winner, message: "Opponent left the game." });
        } else {
          // Adjust current player index if out of bounds
          if (room.gameState.currentPlayerIndex >= room.gameState.players.length) {
            room.gameState.currentPlayerIndex = 0;
          }
        }
      }

      socket.leave(roomId);
      socket.roomId = null;
      socket.playerId = null;

      await syncRoomToSupabase(roomId, room);
      io.to(roomId).emit("room-updated", {
        roomId,
        players: room.players,
        hostId: room.hostId,
        status: room.status,
        gameState: room.gameState ? sanitizeGameState(room.gameState, null) : null,
      });
    }
  });

  // Helper to draw cards
  function drawCardsFromPile(n, drawPile, discardPile) {
    let dp = [...drawPile];
    let disc = [...discardPile];
    const drawn = [];
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

  // Hide other players' cards
  function sanitizeGameState(gameState, targetPlayerId) {
    if (!gameState) return null;
    return {
      ...gameState,
      drawPile: undefined, // Hide draw pile details
      drawPileCount: gameState.drawPile.length,
      players: gameState.players.map(p => {
        const isSelf = p.id === targetPlayerId;
        return {
          id: p.id,
          name: p.name,
          saidUno: p.saidUno,
          cardsCount: p.cards.length,
          cards: isSelf ? p.cards : [], // Hide cards of other players
        };
      }),
    };
  }

  // Broadcast state
  function broadcastGameState(room) {
    room.players.forEach(p => {
      io.to(p.socketId).emit("game-state-updated", sanitizeGameState(room.gameState, p.id));
    });
  }

  httpServer.once("error", (err) => {
    console.error(err);
    process.exit(1);
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
