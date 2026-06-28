"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useMultiplayerStore } from "@/store/multiplayerStore";
import { supabase, hasSupabase, getOrCreateSession } from "@/lib/supabase";

interface LeaderboardEntry {
  username: string;
  wins: number;
  games_played: number;
  score: number;
}

export default function MultiplayerHome() {
  const router = useRouter();
  const {
    playerName,
    playerId,
    setPlayerInfo,
    connectSocket,
    disconnectSocket,
    createRoom,
    joinRoom,
    matchmake,
    roomId,
    status,
    lobbyError,
    isConnecting,
  } = useMultiplayerStore();

  const [usernameInput, setUsernameInput] = useState("");
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
  const [mode, setMode] = useState<"menu" | "matchmaking" | "join">("menu");

  // Load username & authenticates
  useEffect(() => {
    async function initSession() {
      const session = await getOrCreateSession();
      if (session) {
        const storedName = session.username || localStorage.getItem("uno_local_username") || `Player_${Math.floor(1000 + Math.random() * 9000)}`;
        setPlayerInfo(storedName, session.userId);
        setUsernameInput(storedName);
      }
    }
    initSession();
    connectSocket();

    return () => {
      // Clean up connection when leaving the main multiplayer lobby screen
      // but NOT when we are redirected to a lobby.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch leaderboard data
  useEffect(() => {
    async function fetchLeaderboard() {
      if (!hasSupabase) return;
      setLoadingLeaderboard(true);
      try {
        const { data, error } = await supabase
          .from("leaderboard")
          .select("username, wins, games_played, score")
          .order("score", { ascending: false })
          .limit(5);

        if (error) {
          console.warn("Leaderboard table not found in Supabase. Run supabase_schema.sql to set it up:", error.message);
        } else if (data) {
          setLeaderboard(data);
        }
      } catch (err: any) {
        console.warn("Error loading leaderboard (using simulated local rankings):", err?.message || err);
      } finally {
        setLoadingLeaderboard(false);
      }
    }
    fetchLeaderboard();
  }, []);

  // Sync route once room is obtained
  useEffect(() => {
    if (roomId && (status === "waiting" || status === "playing")) {
      router.push(`/multiplayer/${roomId}`);
    }
  }, [roomId, status, router]);

  function handleSaveUsername() {
    if (!usernameInput.trim()) return;
    setPlayerInfo(usernameInput.trim(), playerId || `local-${crypto.randomUUID()}`);

    // Update username metadata in Supabase if exists
    if (hasSupabase && playerId) {
      supabase.auth.updateUser({
        data: { username: usernameInput.trim() }
      }).catch((e: any) => console.error("Error updating user metadata:", e));

      // Update in leaderboard if entry exists
      supabase.from("leaderboard").update({
        username: usernameInput.trim()
      }).eq("user_id", playerId).then(({ error }: any) => {
        if (error) console.warn("Leaderboard username sync skipped:", error.message);
      });
    }
  }

  function handleQuickPlay() {
    handleSaveUsername();
    setMode("matchmaking");
    matchmake();
  }

  function handleCreatePrivateRoom() {
    handleSaveUsername();
    createRoom(true); // create private room code
  }

  function handleJoinWithCode() {
    if (!joinCodeInput.trim()) return;
    handleSaveUsername();
    joinRoom(joinCodeInput.trim().toUpperCase());
  }

  // Removed mock leaderboard dummy data

  return (
    <div className="felt-texture min-h-screen flex flex-col items-center justify-start py-8 px-4 overflow-y-auto font-sans">
      
      {/* Back to Single Player button */}
      <button 
        onClick={() => { disconnectSocket(); router.push("/"); }}
        className="absolute top-4 left-4 bg-white/10 hover:bg-white/20 text-white font-bold py-2 px-4 rounded-xl border border-white/15 transition-all text-sm flex items-center gap-2"
      >
        ← Local Game
      </button>

      <div className="w-full max-w-md flex flex-col gap-6 mt-6">
        
        {/* Header */}
        <div className="text-center">
          <motion.h1
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-6xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-br from-red-500 via-yellow-400 to-blue-500 drop-shadow-2xl"
          >
            MULTIPLAYER
          </motion.h1>
          <p className="text-white/60 text-sm font-bold uppercase tracking-widest mt-1">UNO Online Rooms</p>
        </div>

        {/* Username Setup */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-black/35 backdrop-blur-md rounded-2xl p-5 border border-white/10 flex flex-col gap-3 shadow-xl"
        >
          <label className="text-xs font-black text-white/50 uppercase tracking-widest">Enter Your Nickname</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="Your username..."
              maxLength={15}
              className="flex-1 bg-white/5 border border-white/10 focus:border-yellow-400 focus:outline-none rounded-xl px-4 py-3 text-white font-bold transition-all placeholder-white/35"
            />
            <button
              onClick={handleSaveUsername}
              className="bg-yellow-500 hover:bg-yellow-400 text-yellow-950 font-black px-4 rounded-xl transition-all"
            >
              Save
            </button>
          </div>
        </motion.div>

        {/* Menu Actions */}
        <AnimatePresence mode="wait">
          {mode === "menu" && (
            <motion.div
              key="menu"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col gap-3"
            >
              {/* Matchmaking */}
              <button
                onClick={handleQuickPlay}
                disabled={isConnecting}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-red-600 to-orange-600 border border-red-500 text-white font-black text-xl shadow-lg hover:scale-[1.03] transition-all disabled:opacity-50"
              >
                🎮 Quick Match
              </button>

              <div className="grid grid-cols-2 gap-3">
                {/* Create Private */}
                <button
                  onClick={handleCreatePrivateRoom}
                  disabled={isConnecting}
                  className="py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 text-white font-black text-sm shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  ➕ Create Room
                </button>

                {/* Join Code Mode */}
                <button
                  onClick={() => setMode("join")}
                  disabled={isConnecting}
                  className="py-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 text-white font-black text-sm shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  🔑 Join with Code
                </button>
              </div>

              {lobbyError && (
                <div className="bg-red-500/20 border border-red-500/30 text-red-200 text-xs font-bold text-center rounded-xl p-3">
                  {lobbyError}
                </div>
              )}
            </motion.div>
          )}

          {mode === "matchmaking" && (
            <motion.div
              key="matchmaking"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-black/35 backdrop-blur-md rounded-2xl p-6 border border-white/10 text-center flex flex-col items-center gap-4 shadow-xl"
            >
              <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
              <div>
                <h3 className="text-lg font-black text-white">Searching for Match...</h3>
                <p className="text-white/50 text-xs mt-1">Connecting to players...</p>
              </div>
              <button
                onClick={() => { setMode("menu"); disconnectSocket(); connectSocket(); }}
                className="mt-2 text-white/50 hover:text-white font-bold text-xs underline"
              >
                Cancel Matchmaking
              </button>
            </motion.div>
          )}

          {mode === "join" && (
            <motion.div
              key="join"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-black/35 backdrop-blur-md rounded-2xl p-5 border border-white/10 flex flex-col gap-4 shadow-xl"
            >
              <h3 className="text-lg font-black text-white text-center">Join Private Lobby</h3>
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  placeholder="ENTER 4-LETTER CODE"
                  maxLength={4}
                  className="bg-white/5 border border-white/10 focus:border-yellow-400 focus:outline-none rounded-xl py-3 text-center text-2xl font-black tracking-widest text-white transition-all"
                />
                <button
                  onClick={handleJoinWithCode}
                  className="w-full py-3 bg-yellow-500 hover:bg-yellow-400 text-yellow-950 font-black rounded-xl transition-all"
                >
                  Join Lobby
                </button>
                <button
                  onClick={() => setMode("menu")}
                  className="w-full py-2 bg-transparent text-white/50 hover:text-white font-bold text-xs mt-1"
                >
                  Back to Menu
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Leaderboard */}
        <div className="bg-black/25 backdrop-blur-sm rounded-2xl p-5 border border-white/5 flex flex-col gap-4 shadow-lg">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-black text-white/70 uppercase tracking-widest">🏆 Global Leaderboard</h2>
            {!hasSupabase && (
              <span className="text-[10px] font-bold text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full">Demo Mode</span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {loadingLeaderboard ? (
              <p className="text-white/40 text-xs font-bold text-center py-4">Loading leaderboard rankings...</p>
            ) : leaderboard.length > 0 ? (
              leaderboard.map((entry, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-2.5 border border-white/5"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-5 text-center text-xs font-black ${idx === 0 ? "text-yellow-400" : idx === 1 ? "text-slate-300" : idx === 2 ? "text-amber-600" : "text-white/40"}`}>
                      {idx + 1}
                    </span>
                    <span className="text-white font-bold text-sm">{entry.username}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="text-right">
                      <span className="text-white/40 block font-bold leading-none text-[9px] uppercase">Score</span>
                      <span className="text-white font-black">{entry.score}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-white/40 block font-bold leading-none text-[9px] uppercase">Wins</span>
                      <span className="text-green-400 font-black">{entry.wins}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-white/30 text-center text-xs py-4 font-bold">No scores recorded yet. Be the first to win a game!</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
