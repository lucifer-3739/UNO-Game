import { create } from "zustand";
import { io, Socket } from "socket.io-client";
import { Card, Color, Player, GamePhase, Toast } from "@/types/uno";
import { supabase, hasSupabase } from "@/lib/supabase";

export interface MultiplayerPlayer {
  id: string;
  name: string;
  socketId: string;
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
  roundScore: number;
  toasts: Toast[];
  drawnCard: Card | null;

  // Connection & Room UI
  roomId: string | null;
  isHost: boolean;
  status: "idle" | "waiting" | "playing" | "finished";
  socket: Socket | null;
  playerName: string;
  playerId: string;
  isConnecting: boolean;
  lobbyError: string | null;

  // Audio Chat
  localStream: MediaStream | null;
  isMuted: boolean;
  activePeerConnections: Record<string, RTCPeerConnection>; // socketId -> RTCPeerConnection
  remoteStreams: Record<string, MediaStream>; // socketId -> MediaStream

  // Actions
  setPlayerInfo: (name: string, id: string) => void;
  connectSocket: () => void;
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

let socketInstance: Socket | null = null;

// Sound helper
async function playSound(fn: string, ...args: any[]) {
  if (typeof window === "undefined") return;
  try {
    const sounds = await import("@/lib/sounds");
    (sounds as any)[fn]?.(...args);
  } catch (e) {
    /* Ignore */
  }
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
  socket: null,
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
    const state = get();
    if (state.socket) return;

    set({ isConnecting: true });

    // Establish WebSocket connection
    const socket = io(typeof window !== "undefined" ? window.location.origin : "http://localhost:3000", {
      autoConnect: true,
    });

    socketInstance = socket;

    socket.on("connect", () => {
      set({ socket, isConnecting: false });
      console.log("Multiplayer socket connected");
    });

    socket.on("connect_error", () => {
      set({ isConnecting: false, lobbyError: "Failed to connect to matchmaking server." });
    });

    // Room update events
    socket.on("room-updated", ({ roomId, players, hostId, status, gameState }) => {
      const { playerId } = get();
      const isHost = hostId === playerId;
      const myInfo = players.find((p: any) => p.id === playerId);

      const newState: Partial<MultiplayerGameState> = {
        players,
        isHost,
        status,
        roomId,
      };

      if (gameState) {
        newState.currentPlayerIndex = gameState.currentPlayerIndex;
        newState.drawPileCount = gameState.drawPileCount;
        newState.discardPile = gameState.discardPile;
        newState.direction = gameState.direction;
        newState.activeColor = gameState.activeColor;
        newState.toasts = gameState.toasts || [];
        newState.drawnCard = gameState.drawnCard;

        const myPlayerState = gameState.players.find((p: any) => p.id === playerId);
        if (myPlayerState) {
          newState.myCards = myPlayerState.cards;
        }
      }

      set(newState);

      // Handle WebRTC Peer additions when a new player joins
      const localStream = get().localStream;
      if (localStream) {
        players.forEach((p: any) => {
          if (p.id !== playerId && p.socketId && !get().activePeerConnections[p.socketId]) {
            // Initiate WebRTC connection to new participant
            initiateCall(p.socketId);
          }
        });
      }
    });

    socket.on("join-error", ({ message }) => {
      set({ lobbyError: message });
    });

    // Game started event
    socket.on("game-started", ({ status, gameState, players }) => {
      const { playerId } = get();
      const myPlayerState = gameState.players.find((p: any) => p.id === playerId);
      playSound("playShuffle");

      set({
        status,
        players,
        currentPlayerIndex: gameState.currentPlayerIndex,
        drawPileCount: gameState.drawPileCount,
        discardPile: gameState.discardPile,
        direction: gameState.direction,
        activeColor: gameState.activeColor,
        myCards: myPlayerState ? myPlayerState.cards : [],
        toasts: gameState.toasts || [],
        winnerId: null,
        winnerName: null,
      });
    });

    // Game state updates
    socket.on("game-state-updated", (gameState) => {
      const { playerId } = get();
      const myPlayerState = gameState.players.find((p: any) => p.id === playerId);

      const topCard = gameState.discardPile[gameState.discardPile.length - 1];
      const prevTopCard = get().discardPile[get().discardPile.length - 1];

      if (topCard && topCard.id !== prevTopCard?.id) {
        if (topCard.value === "wild" || topCard.value === "wild4") {
          playSound("playWild");
        } else {
          playSound("playCardPlay", topCard.color);
        }
      }

      set({
        currentPlayerIndex: gameState.currentPlayerIndex,
        drawPileCount: gameState.drawPileCount,
        discardPile: gameState.discardPile,
        direction: gameState.direction,
        activeColor: gameState.activeColor,
        myCards: myPlayerState ? myPlayerState.cards : [],
        toasts: gameState.toasts || [],
        drawnCard: gameState.drawnCard,
      });
    });

    // Game Over
    socket.on("game-over", async ({ winnerName, winnerId, score }) => {
      playSound("playWin");
      const roundScore = score || 0;
      set({ status: "finished", winnerName, winnerId, roundScore });

      // Save win stats to Supabase using upsert
      const { playerId, playerName } = get();
      if (hasSupabase) {
        try {
          const isWinner = playerId === winnerId;
          const { data: current, error: selectError } = await supabase
            .from("leaderboard")
            .select("*")
            .eq("user_id", playerId)
            .maybeSingle();

          if (selectError) {
            console.error("Supabase leaderboard query failed:", selectError.message);
          }

          const wins = (current?.wins || 0) + (isWinner ? 1 : 0);
          const games_played = (current?.games_played || 0) + 1;
          const scoreToAdd = isWinner ? roundScore : 10;
          const newScore = (current?.score || 0) + scoreToAdd;

          const { error: upsertError } = await supabase.from("leaderboard").upsert(
            {
              user_id: playerId,
              username: playerName,
              wins,
              games_played,
              score: newScore,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          );

          if (upsertError) {
            console.error("Supabase leaderboard upsert failed:", upsertError.message);
          } else {
            console.log("Supabase score successfully saved for player:", playerName, "Score +", scoreToAdd);
          }
        } catch (e) {
          console.error("Failed to update leaderboard stats:", e);
        }
      }
    });

    // WebRTC signaling
    socket.on("webrtc-signal", async ({ senderSocketId, signalData }) => {
      let pc = get().activePeerConnections[senderSocketId];

      if (!pc) {
        pc = createPeerConnection(senderSocketId);
      }

      try {
        if (signalData.type === "offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("webrtc-signal", {
            roomId: get().roomId,
            targetSocketId: senderSocketId,
            signalData: { type: "answer", sdp: answer },
          });
        } else if (signalData.type === "answer") {
          await pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp));
        } else if (signalData.type === "ice-candidate") {
          if (signalData.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
          }
        }
      } catch (err) {
        console.error("Error handling WebRTC signal:", err);
      }
    });
  },

  disconnectSocket: () => {
    const socket = get().socket;
    if (socket) {
      socket.disconnect();
    }
    get().clearAudioChat();
    set({ socket: null, roomId: null, status: "idle", players: [], myCards: [] });
  },

  createRoom: (isPrivate = false) => {
    const { socket, playerName, playerId } = get();
    if (!socket) return;
    const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
    (socket as any).roomId = roomCode;
    socket.emit("join-room", { roomId: roomCode, playerName, playerId, isPrivate });
  },

  joinRoom: (roomId) => {
    const { socket, playerName, playerId } = get();
    if (!socket) return;
    (socket as any).roomId = roomId.toUpperCase();
    socket.emit("join-room", { roomId: roomId.toUpperCase(), playerName, playerId });
  },

  matchmake: () => {
    const { socket, playerName, playerId } = get();
    if (!socket) return;
    set({ lobbyError: null });
    socket.emit("matchmake", { playerName, playerId });
    socket.once("matchmake-result", ({ roomId }) => {
      (socket as any).roomId = roomId;
      socket.emit("join-room", { roomId, playerName, playerId });
    });
  },

  startGame: () => {
    const { socket, roomId } = get();
    if (!socket || !roomId) return;
    socket.emit("start-game", { roomId });
  },

  leaveRoom: () => {
    const { socket } = get();
    if (socket) {
      socket.emit("leave-room");
    }
    get().clearAudioChat();
    set({ roomId: null, status: "idle", players: [], myCards: [], winnerName: null, winnerId: null });
  },

  // Game action dispatchers
  playCard: (cardId, wildColor) => {
    const { socket, roomId } = get();
    if (!socket || !roomId) return;
    socket.emit("game-action", {
      roomId,
      action: "play-card",
      data: { cardId, wildColor },
    });
  },

  drawCard: () => {
    const { socket, roomId } = get();
    if (!socket || !roomId) return;
    playSound("playCardDraw");
    socket.emit("game-action", {
      roomId,
      action: "draw-card",
      data: {},
    });
  },

  playDrawnCard: (wildColor) => {
    const { socket, roomId } = get();
    if (!socket || !roomId) return;
    socket.emit("game-action", {
      roomId,
      action: "play-drawn",
      data: { wildColor },
    });
  },

  passAfterDraw: () => {
    const { socket, roomId } = get();
    if (!socket || !roomId) return;
    socket.emit("game-action", {
      roomId,
      action: "pass",
      data: {},
    });
  },

  callUno: () => {
    const { socket, roomId } = get();
    if (!socket || !roomId) return;
    playSound("playUnoCall");
    socket.emit("game-action", {
      roomId,
      action: "call-uno",
      data: {},
    });
  },

  catchUno: (targetPlayerId) => {
    const { socket, roomId } = get();
    if (!socket || !roomId) return;
    playSound("playPenalty");
    socket.emit("game-action", {
      roomId,
      action: "catch-uno",
      data: { targetPlayerId },
    });
  },

  // ── WebRTC Audio Chat Actions ──
  initAudioChat: async () => {
    try {
      const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      set({ localStream, isMuted: false });

      const { activePeerConnections, players, playerId, socket } = get();
      const track = localStream.getAudioTracks()[0];

      // Add our track to any existing peer connections (renegotiation)
      Object.entries(activePeerConnections).forEach(async ([socketId, pc]) => {
        const senders = pc.getSenders();
        const hasTrack = senders.some((s) => s.track === track);
        if (!hasTrack) {
          pc.addTrack(track, localStream);
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket?.emit("webrtc-signal", {
              roomId: get().roomId,
              targetSocketId: socketId,
              signalData: { type: "offer", sdp: offer },
            });
          } catch (e) {
            console.error("Renegotiation failed:", e);
          }
        }
      });

      // Connect WebRTC to any remaining players
      players.forEach((p) => {
        if (p.id !== playerId && p.socketId && !activePeerConnections[p.socketId]) {
          initiateCall(p.socketId);
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

    // Stop microphone recording
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }

    // Close all Peer Connections
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

// WebRTC Connections Signalling Helpers
function createPeerConnection(targetSocketId: string): RTCPeerConnection {
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

  // Handle ICE candidate generation
  pc.onicecandidate = (event) => {
    const { socket, roomId } = useMultiplayerStore.getState();
    if (event.candidate && socket && roomId) {
      socket.emit("webrtc-signal", {
        roomId,
        targetSocketId,
        signalData: {
          type: "ice-candidate",
          candidate: event.candidate,
        },
      });
    }
  };

  // Receive remote track (voice stream)
  pc.ontrack = (event) => {
    console.log(`Received remote track from ${targetSocketId}`);
    const remoteStream = event.streams[0];

    // Play remote track by appending it to the DOM to guarantee playback on all browsers
    if (typeof window !== "undefined") {
      const audio = document.createElement("audio");
      audio.style.display = "none";
      audio.autoplay = true;
      audio.srcObject = remoteStream;
      document.body.appendChild(audio);
      (pc as any).audioElement = audio;
    }

    setRemoteStream(targetSocketId, remoteStream);
  };

  // Connection close listener
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "disconnected" || pc.connectionState === "failed" || pc.connectionState === "closed") {
      removePeerConnection(targetSocketId);
    }
  };

  // Cache RTCPeerConnection
  const pcs = { ...useMultiplayerStore.getState().activePeerConnections };
  pcs[targetSocketId] = pc;
  useMultiplayerStore.setState({ activePeerConnections: pcs });

  return pc;
}

async function initiateCall(targetSocketId: string) {
  const pc = createPeerConnection(targetSocketId);
  const { socket, roomId } = useMultiplayerStore.getState();
  if (!socket || !roomId) return;

  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit("webrtc-signal", {
      roomId,
      targetSocketId,
      signalData: {
        type: "offer",
        sdp: offer,
      },
    });
  } catch (err) {
    console.error("Failed to generate WebRTC offer:", err);
  }
}

function setRemoteStream(socketId: string, stream: MediaStream) {
  const streams = { ...useMultiplayerStore.getState().remoteStreams };
  streams[socketId] = stream;
  useMultiplayerStore.setState({ remoteStreams: streams });
}

function removePeerConnection(socketId: string) {
  const pcs = { ...useMultiplayerStore.getState().activePeerConnections };
  const streams = { ...useMultiplayerStore.getState().remoteStreams };

  if (pcs[socketId]) {
    const audio = (pcs[socketId] as any).audioElement;
    if (audio) {
      try {
        audio.pause();
        audio.remove();
      } catch (err) {
        console.warn(err);
      }
    }
    pcs[socketId].close();
    delete pcs[socketId];
  }
  if (streams[socketId]) {
    delete streams[socketId];
  }

  useMultiplayerStore.setState({
    activePeerConnections: pcs,
    remoteStreams: streams,
  });
}
