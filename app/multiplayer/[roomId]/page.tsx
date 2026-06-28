"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useMultiplayerStore } from "@/store/multiplayerStore";
import { getOrCreateSession } from "@/lib/supabase";
import MultiplayerGameBoard from "@/components/MultiplayerGameBoard";
import { Mic, MicOff, Volume2, Share2, Copy, Check, Users, Home } from "lucide-react";

export default function MultiplayerRoom() {
  const params = useParams();
  const router = useRouter();
  const roomId = (params?.roomId as string || "").toUpperCase();

  const {
    players,
    status,
    isHost,
    playerName,
    playerId,
    lobbyError,
    setPlayerInfo,
    connectSocket,
    joinRoom,
    startGame,
    leaveRoom,
    initAudioChat,
    toggleMute,
    isMuted,
    localStream,
    activePeerConnections,
  } = useMultiplayerStore();

  const [usernamePrompt, setUsernamePrompt] = useState("");
  const [needUsername, setNeedUsername] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Initialize Socket connection and handle URL entry
  useEffect(() => {
    async function initRoom() {
      // 1. Ensure user session exists
      const session = await getOrCreateSession();
      let activeId = playerId;
      let activeName = playerName;

      if (session) {
        if (!playerId) {
          activeId = session.userId;
          activeName = session.username || `Player_${Math.floor(1000 + Math.random() * 9000)}`;
          setPlayerInfo(activeName, activeId);
        }
      }

      // 2. If username is not set, prompt user
      if (!activeName || activeName.startsWith("Player_")) {
        setNeedUsername(true);
        return;
      }

      // 3. Connect socket & join room
      connectSocket();
    }

    if (roomId) {
      initRoom();
    }
  }, [roomId, playerId, playerName, connectSocket, setPlayerInfo]);

  // Join room once username is set
  useEffect(() => {
    if (roomId && playerName && playerId && status === "idle") {
      joinRoom(roomId);
    }
  }, [roomId, playerName, playerId, status, joinRoom]);

  // Cleanup when navigating away
  useEffect(() => {
    return () => {
      // Do not auto-leave if we are in game
    };
  }, []);

  function handlePromptSubmit() {
    if (!usernamePrompt.trim()) return;
    const genId = playerId || `local-${crypto.randomUUID()}`;
    setPlayerInfo(usernamePrompt.trim(), genId);
    setNeedUsername(false);
    connectSocket();
  }

  function handleCopyLink() {
    if (typeof window === "undefined") return;
    const inviteUrl = `${window.location.origin}/multiplayer/${roomId}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  function handleCopyCode() {
    navigator.clipboard.writeText(roomId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  function handleQuit() {
    leaveRoom();
    router.push("/multiplayer");
  }

  // Render Name Input Screen if user joined directly via link and lacks a profile
  if (needUsername) {
    return (
      <div className="felt-texture min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-sm bg-black/40 backdrop-blur-md rounded-2xl p-6 border border-white/10 flex flex-col gap-4 text-center"
        >
          <div className="text-4xl">🃏</div>
          <div>
            <h2 className="text-2xl font-black text-white">Join UNO Room</h2>
            <p className="text-white/60 text-xs mt-1">You have been invited to join room <span className="text-yellow-400 font-bold">{roomId}</span></p>
          </div>

          <div className="flex flex-col gap-2 text-left">
            <label className="text-xs font-bold text-white/50 uppercase tracking-wide">Enter Nickname</label>
            <input
              type="text"
              value={usernamePrompt}
              onChange={(e) => setUsernamePrompt(e.target.value)}
              placeholder="e.g. WildCard"
              maxLength={15}
              className="bg-white/5 border border-white/10 focus:border-yellow-400 focus:outline-none rounded-xl px-4 py-3 text-white font-bold transition-all"
            />
          </div>

          <button
            onClick={handlePromptSubmit}
            className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-yellow-950 font-black rounded-xl transition-all shadow-md"
          >
            Join Game Lobby
          </button>
        </motion.div>
      </div>
    );
  }

  // If in game, render Multiplayer Board
  if (status === "playing" || status === "finished") {
    return <MultiplayerGameBoard />;
  }

  // Otherwise, render Lobby (Waiting Phase)
  return (
    <div className="felt-texture min-h-screen flex flex-col items-center justify-start py-8 px-4 overflow-y-auto font-sans text-white">
      
      {/* Leave button */}
      <button
        onClick={handleQuit}
        className="absolute top-4 left-4 bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-4 rounded-xl border border-white/15 transition-all text-sm flex items-center gap-1.5"
      >
        🏠 Leave Lobby
      </button>

      <div className="w-full max-w-md flex flex-col gap-6 mt-8">
        
        {/* Header & Code Display */}
        <div className="text-center bg-black/25 backdrop-blur-sm rounded-2xl p-5 border border-white/5 shadow-md flex flex-col items-center gap-3">
          <span className="text-[10px] font-bold text-yellow-400 bg-yellow-400/10 px-3 py-1 rounded-full uppercase tracking-widest">
            Room Code
          </span>
          <div className="flex items-center gap-2">
            <h1 className="text-5xl font-black tracking-widest text-white">{roomId}</h1>
            <button
              onClick={handleCopyCode}
              className="p-2 hover:bg-white/10 rounded-lg transition-all text-white/60 hover:text-white"
              title="Copy Room Code"
            >
              {copiedCode ? <Check className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
          <p className="text-white/40 text-xs">Share this code with friends or send them the invite link!</p>
          
          <button
            onClick={handleCopyLink}
            className="mt-1 w-full py-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-xs font-bold transition-all flex items-center justify-center gap-2"
          >
            {copiedLink ? (
              <>
                <Check className="w-4 h-4 text-green-400" />
                Copied Invite Link!
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                Copy Invite Link
              </>
            )}
          </button>
        </div>

        {/* Voice Chat Controls */}
        <div className="bg-black/35 backdrop-blur-md rounded-2xl p-5 border border-white/10 flex flex-col gap-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-white/70 uppercase tracking-widest flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-green-400 animate-pulse" /> Voice Channel
              </h2>
              <p className="text-[10px] text-white/40 mt-0.5">Discuss strategy or scream UNO!</p>
            </div>
            {localStream ? (
              <button
                onClick={toggleMute}
                className={`p-2.5 rounded-xl border transition-all ${isMuted ? "bg-red-500/20 border-red-500 text-red-400" : "bg-green-500/20 border-green-500 text-green-400"}`}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
            ) : (
              <button
                onClick={initAudioChat}
                className="py-1.5 px-3 bg-green-600 hover:bg-green-500 rounded-xl text-xs font-black transition-all"
              >
                Connect Mic
              </button>
            )}
          </div>
        </div>

        {/* Players List */}
        <div className="bg-black/25 backdrop-blur-sm rounded-2xl p-5 border border-white/5 flex flex-col gap-4 shadow-lg">
          <h2 className="text-sm font-black text-white/70 uppercase tracking-widest flex items-center gap-1.5">
            <Users className="w-4 h-4" /> Players ({players.length}/4)
          </h2>

          <div className="flex flex-col gap-2">
            {players.map((p) => {
              const hasVoice = p.id === playerId ? !!localStream : !!activePeerConnections[p.id];
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3 border border-white/5"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold">{p.name}</span>
                    {p.id === playerId && (
                      <span className="text-[9px] font-bold bg-white/10 text-white/60 px-1.5 py-0.5 rounded">You</span>
                    )}
                    {p.isHost && (
                      <span className="text-[9px] font-bold bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded">Host</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {hasVoice ? (
                      <span className="text-[10px] font-bold text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Mic className="w-3 h-3" /> Voice
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-white/20 bg-white/5 px-2 py-0.5 rounded-full">
                        No voice
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {players.length === 1 && (
              <p className="text-white/30 text-center text-xs font-bold py-4">Waiting for players to join...</p>
            )}
          </div>
        </div>

        {/* Start Game Action */}
        {isHost ? (
          <button
            onClick={startGame}
            disabled={players.length < 2}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 border border-green-500 text-white font-black text-xl shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100"
          >
            🏁 Start Game
          </button>
        ) : (
          <div className="bg-black/35 backdrop-blur-md rounded-2xl p-4 border border-white/10 text-center font-bold text-sm text-yellow-400 animate-pulse">
            Waiting for Host to start the game...
          </div>
        )}

        {lobbyError && (
          <div className="bg-red-500/20 border border-red-500/30 text-red-200 text-xs font-bold text-center rounded-xl p-3">
            {lobbyError}
          </div>
        )}

      </div>
    </div>
  );
}
