"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useMultiplayerStore, MultiplayerPlayer } from "@/store/multiplayerStore";
import { canPlayCard } from "@/lib/gameEngine";
import Card from "./Card";
import DrawPile from "./DrawPile";
import DiscardPile from "./DiscardPile";
import ColorPicker from "./ColorPicker";
import UnoButton from "./UnoButton";
import { Mic, MicOff, Volume2, ArrowRightLeft, ShieldAlert, LogOut, Trophy } from "lucide-react";
import { Color, Toast } from "@/types/uno";

export default function MultiplayerGameBoard() {
  const router = useRouter();
  const {
    players,
    myCards,
    currentPlayerIndex,
    drawPileCount,
    discardPile,
    direction,
    activeColor,
    winnerId,
    winnerName,
    roundScore,
    toasts,
    drawnCard,
    roomId,
    playerId,
    isMuted,
    localStream,
    activePeerConnections,
    toggleMute,
    playCard,
    drawCard,
    playDrawnCard,
    passAfterDraw,
    callUno,
    catchUno,
    leaveRoom,
    dismissToast,
  } = useMultiplayerStore();

  const [wildCardId, setWildCardId] = useState<string | null>(null);
  const [wildDrawnPlay, setWildDrawnPlay] = useState<boolean>(false);
  const [showPicker, setShowPicker] = useState(false);

  // Sound lazy loader
  async function snd(fn: string, ...args: any[]) {
    try {
      const sounds = await import("@/lib/sounds");
      (sounds as any)[fn]?.(...args);
    } catch { /* ignore */ }
  }

  const topCard = discardPile[discardPile.length - 1] || null;
  const myIndex = players.findIndex((p) => p.id === playerId);
  const myPlayer = players[myIndex];
  const isMyTurn = currentPlayerIndex === myIndex;

  // Order players relative to myself (clockwise: bottom -> left -> top -> right)
  const orderedPlayers: (MultiplayerPlayer | null)[] = [null, null, null, null]; // [bottom, left, top, right]
  if (myIndex !== -1) {
    orderedPlayers[0] = players[myIndex]; // Bottom (myself)

    if (players.length === 2) {
      const oppIdx = (myIndex + 1) % 2;
      orderedPlayers[2] = players[oppIdx]; // Top (opponent)
    } else if (players.length === 3) {
      const leftIdx = (myIndex + 1) % 3;
      const rightIdx = (myIndex + 2) % 3;
      orderedPlayers[1] = players[leftIdx]; // Left
      orderedPlayers[3] = players[rightIdx]; // Right
    } else if (players.length === 4) {
      const leftIdx = (myIndex + 1) % 4;
      const topIdx = (myIndex + 2) % 4;
      const rightIdx = (myIndex + 3) % 4;
      orderedPlayers[1] = players[leftIdx]; // Left
      orderedPlayers[2] = players[topIdx]; // Top
      orderedPlayers[3] = players[rightIdx]; // Right
    }
  }

  // Playable cards calculation
  const playableIds = new Set<string>(
    isMyTurn && topCard
      ? myCards.filter((c) => canPlayCard(c, topCard, activeColor)).map((c) => c.id)
      : []
  );

  // Check if we need to show Catch button (an opponent has exactly 1 card and hasn't said UNO)
  const opponentToCatch = players.find(
    (p) => p.id !== playerId && p.cardsCount === 1 && !p.saidUno
  );

  function handlePlayCardClick(cardId: string) {
    if (!isMyTurn) return;
    const card = myCards.find((c) => c.id === cardId);
    if (!card) return;

    if (card.value === "wild" || card.value === "wild4") {
      setWildCardId(cardId);
      setWildDrawnPlay(false);
      setShowPicker(true);
    } else {
      playCard(cardId);
    }
  }

  function handlePickColor(color: Color) {
    setShowPicker(false);
    if (wildCardId) {
      if (wildDrawnPlay) {
        playDrawnCard(color);
      } else {
        playCard(wildCardId, color);
      }
      setWildCardId(null);
    }
  }

  function handlePlayDrawnClick() {
    if (!drawnCard) return;
    if (drawnCard.value === "wild" || drawnCard.value === "wild4") {
      setWildCardId(drawnCard.id);
      setWildDrawnPlay(true);
      setShowPicker(true);
    } else {
      playDrawnCard();
    }
  }

  function handleQuit() {
    leaveRoom();
    router.push("/multiplayer");
  }

  return (
    <div className="table-bg min-h-screen flex flex-col justify-between overflow-hidden relative font-sans text-white">
      
      {/* ── Top Bar ── */}
      <header className="bg-black/35 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center justify-between z-10 select-none">
        <div className="flex items-center gap-3">
          <button
            onClick={handleQuit}
            className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white/80 hover:text-white transition-all text-xs font-bold flex items-center gap-1.5"
          >
            <LogOut className="w-4 h-4" /> Leave Room
          </button>
          <div className="text-xs text-white/50">
            Room Code: <span className="text-yellow-400 font-bold">{roomId}</span>
          </div>
        </div>

        {/* Direction & Turn Tracker */}
        <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/5 text-xs font-black uppercase tracking-wider">
          <ArrowRightLeft className={`w-3.5 h-3.5 text-yellow-400 ${direction === -1 ? "scale-x-[-1]" : ""}`} />
          <span>{direction === 1 ? "Clockwise" : "Counter-Clockwise"}</span>
        </div>

        {/* Voice status */}
        <div className="flex items-center gap-3">
          {localStream ? (
            <button
              onClick={toggleMute}
              className={`p-2 rounded-lg border transition-all ${isMuted ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-green-500/10 border-green-500/30 text-green-400"}`}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
          ) : (
            <span className="text-[10px] text-white/40 font-bold bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5">Voice offline</span>
          )}
        </div>
      </header>

      {/* ── Game Table Layout ── */}
      <main className="flex-1 relative flex items-center justify-center p-4">
        
        {/* Play Direction Indicator Circle */}
        <div className="absolute w-[280px] h-[280px] rounded-full border border-white/5 flex items-center justify-center pointer-events-none select-none">
          <motion.div
            animate={{ rotate: direction === 1 ? 360 : -360 }}
            transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
            className="w-full h-full border-t border-b border-yellow-400/15 rounded-full"
          />
        </div>

        {/* OPPONENT TOP */}
        {orderedPlayers[2] && (
          <div className="absolute top-4 flex flex-col items-center select-none">
            <div className={`px-4 py-2 rounded-xl flex items-center gap-2.5 shadow-md border transition-all ${currentPlayerIndex === players.findIndex(p => p.id === orderedPlayers[2]!.id) ? "bg-yellow-500/25 border-yellow-400 scale-105" : "bg-black/30 border-white/5"}`}>
              <div className="flex flex-col text-center">
                <span className="text-xs font-bold leading-none">{orderedPlayers[2].name}</span>
                <span className="text-[9px] text-white/50 mt-0.5 leading-none">{orderedPlayers[2].cardsCount} card{orderedPlayers[2].cardsCount !== 1 ? "s" : ""}</span>
              </div>
              {orderedPlayers[2].saidUno && (
                <span className="bg-red-600 text-white font-black text-[9px] px-1.5 py-0.5 rounded animate-bounce">UNO</span>
              )}
            </div>
            {/* Fake Cards fan */}
            <div className="flex gap-0.5 mt-2 justify-center max-w-[120px] overflow-hidden opacity-85">
              {Array.from({ length: Math.min(orderedPlayers[2].cardsCount, 6) }).map((_, i) => (
                <div key={i} className="w-5 h-7 rounded-sm border border-white bg-indigo-950 flex-shrink-0" />
              ))}
              {orderedPlayers[2].cardsCount > 6 && <span className="text-[10px] self-end font-bold text-white/50 ml-1">+{orderedPlayers[2].cardsCount - 6}</span>}
            </div>
          </div>
        )}

        {/* OPPONENT LEFT */}
        {orderedPlayers[1] && (
          <div className="absolute left-4 flex flex-col items-center select-none">
            <div className={`px-4 py-2 rounded-xl flex items-center gap-2.5 shadow-md border transition-all ${currentPlayerIndex === players.findIndex(p => p.id === orderedPlayers[1]!.id) ? "bg-yellow-500/25 border-yellow-400 scale-105" : "bg-black/30 border-white/5"}`}>
              <div className="flex flex-col">
                <span className="text-xs font-bold leading-none">{orderedPlayers[1].name}</span>
                <span className="text-[9px] text-white/50 mt-0.5 leading-none">{orderedPlayers[1].cardsCount} card{orderedPlayers[1].cardsCount !== 1 ? "s" : ""}</span>
              </div>
              {orderedPlayers[1].saidUno && (
                <span className="bg-red-600 text-white font-black text-[9px] px-1.5 py-0.5 rounded animate-bounce">UNO</span>
              )}
            </div>
          </div>
        )}

        {/* CENTER DECK & DISCARD PILE */}
        <div className="flex items-center gap-6 z-10 select-none">
          <DrawPile
            count={drawPileCount}
            onClick={drawCard}
            canDraw={isMyTurn && !drawnCard}
          />
          <DiscardPile
            topCard={topCard}
            activeColor={activeColor}
          />
        </div>

        {/* OPPONENT RIGHT */}
        {orderedPlayers[3] && (
          <div className="absolute right-4 flex flex-col items-center select-none">
            <div className={`px-4 py-2 rounded-xl flex items-center gap-2.5 shadow-md border transition-all ${currentPlayerIndex === players.findIndex(p => p.id === orderedPlayers[3]!.id) ? "bg-yellow-500/25 border-yellow-400 scale-105" : "bg-black/30 border-white/5"}`}>
              <div className="flex flex-col text-right">
                <span className="text-xs font-bold leading-none">{orderedPlayers[3].name}</span>
                <span className="text-[9px] text-white/50 mt-0.5 leading-none">{orderedPlayers[3].cardsCount} card{orderedPlayers[3].cardsCount !== 1 ? "s" : ""}</span>
              </div>
              {orderedPlayers[3].saidUno && (
                <span className="bg-red-600 text-white font-black text-[9px] px-1.5 py-0.5 rounded animate-bounce">UNO</span>
              )}
            </div>
          </div>
        )}

      </main>

      {/* ── Bottom Controls & Hand ── */}
      <footer className="bg-black/25 backdrop-blur-sm border-t border-white/5 py-4 px-2 flex flex-col items-center gap-3 z-10">
        
        {/* Turn indicator banner */}
        <div className="text-center font-bold text-sm tracking-wider uppercase">
          {isMyTurn ? (
            <span className="text-yellow-400 animate-pulse">⭐ Your Turn! ⭐</span>
          ) : (
            <span className="text-white/40">Waiting for {players[currentPlayerIndex]?.name || "Opponent"}...</span>
          )}
        </div>

        {/* Hand Cards */}
        <div className="flex flex-wrap justify-center gap-2 max-w-3xl">
          <AnimatePresence mode="popLayout">
            {myCards.map((card) => (
              <motion.div
                key={card.id}
                initial={{ scale: 0.8, opacity: 0, y: 30 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.5, opacity: 0, y: 40 }}
                layout
              >
                <Card
                  card={card}
                  isPlayable={playableIds.has(card.id)}
                  onClick={playableIds.has(card.id) ? () => handlePlayCardClick(card.id) : undefined}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="text-white/40 text-xs font-medium mt-1">
          {myCards.length} card{myCards.length !== 1 ? "s" : ""} in your hand
        </div>
      </footer>

      {/* ── Turn Modals & Overlays ── */}

      {/* Color Picker Overlay */}
      <ColorPicker
        isOpen={showPicker}
        onPick={handlePickColor}
      />

      {/* Drawn Card Interaction Banner */}
      <AnimatePresence>
        {isMyTurn && drawnCard && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed inset-x-0 bottom-36 mx-auto w-fit z-30 bg-black/85 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex flex-col items-center gap-3 shadow-2xl"
          >
            <div className="text-center">
              <span className="text-[10px] font-black text-yellow-400 uppercase tracking-widest leading-none">Drawn Card</span>
              <p className="text-white text-xs font-medium mt-0.5">Do you want to play it immediately?</p>
            </div>
            
            <div className="flex items-center gap-4">
              <Card card={drawnCard} small />
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={handlePlayDrawnClick}
                  className="bg-green-600 hover:bg-green-500 text-white font-black px-4 py-2 rounded-xl text-xs transition-all shadow-md"
                >
                  Play Card
                </button>
                <button
                  onClick={passAfterDraw}
                  className="bg-white/10 hover:bg-white/25 text-white/80 hover:text-white font-bold px-4 py-2 rounded-xl text-xs transition-all border border-white/5"
                >
                  Pass Turn
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* UNO Call Buttons */}
      <UnoButton
        visible={isMyTurn && myCards.length === 2 && !myPlayer?.saidUno}
        onCall={callUno}
        canCatch={!!opponentToCatch}
        onCatch={() => opponentToCatch && catchUno(opponentToCatch.id)}
      />

      {/* Game Over Win Screen Overlay */}
      <AnimatePresence>
        {winnerName && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 font-sans select-none"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-black/35 backdrop-blur-md rounded-2xl border border-white/10 p-8 max-w-sm w-full text-center flex flex-col items-center gap-5 shadow-2xl"
            >
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 0.8 }}
                className="text-7xl"
              >
                {winnerId === playerId ? "🏆" : "🎉"}
              </motion.div>

              <div>
                <h1 className="text-4xl font-black tracking-wide">
                  {winnerId === playerId ? "You Won!" : `${winnerName} Wins!`}
                </h1>
                <p className="text-white/40 text-xs mt-1 uppercase tracking-wider">UNO multiplayer showdown</p>
              </div>

              <div className="bg-white/5 rounded-2xl border border-white/5 w-full p-4 flex flex-col gap-2.5">
                <h3 className="text-xs font-black text-white/60 uppercase tracking-widest text-left">Match Summary</h3>
                <div className="h-px bg-white/10" />
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-white/40">Winner</span>
                  <span className="text-yellow-400">{winnerName}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-white/40">Points Earned</span>
                  <span className="text-green-400">{winnerId === playerId ? `+${roundScore} Score` : "+10 Score"}</span>
                </div>
              </div>

              <button
                onClick={handleQuit}
                className="w-full py-4 bg-gradient-to-r from-red-600 to-orange-600 border border-red-500 rounded-2xl text-white font-black text-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Back to Lobby
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Active Toasts / Info Logs ── */}
      <div className="fixed top-16 right-4 z-50 flex flex-col gap-2 max-w-xs pointer-events-none select-none">
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ x: 100, opacity: 0, scale: 0.9 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              exit={{ x: 100, opacity: 0, scale: 0.9 }}
              onClick={() => dismissToast(t.id)}
              className={`p-3 rounded-xl border font-bold text-xs pointer-events-auto cursor-pointer shadow-lg flex items-center gap-2 ${
                t.type === "success"
                  ? "bg-green-600/90 border-green-400 text-white"
                  : t.type === "warning"
                  ? "bg-yellow-600/90 border-yellow-400 text-white"
                  : t.type === "error"
                  ? "bg-red-600/90 border-red-400 text-white"
                  : "bg-blue-600/90 border-blue-400 text-white"
              }`}
            >
              <span>
                {t.type === "success" ? "✅" : t.type === "warning" ? "⚠️" : t.type === "error" ? "❌" : "ℹ️"}
              </span>
              <span>{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

    </div>
  );
}
