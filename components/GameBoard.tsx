"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "@/store/gameStore";
import { canPlayCard } from "@/lib/gameEngine";
import PlayerHand    from "./PlayerHand";
import DrawPile      from "./DrawPile";
import DiscardPile   from "./DiscardPile";
import ColorPicker   from "./ColorPicker";
import UnoButton     from "./UnoButton";
import WinScreen     from "./WinScreen";
import GameInfo      from "./GameInfo";
import ChallengeModal  from "./ChallengeModal";
import DrawnCardBanner from "./DrawnCardBanner";
import ToastContainer  from "./Toast";

interface Props {
  difficulty?: "easy" | "medium" | "hard";
}

export default function GameBoard({ difficulty = "medium" }: Props) {
  const router = useRouter();

  // ── Muted toggle ──
  const mutedRef = useRef(false);

  const {
    players, currentPlayer, drawPile, discardPile,
    activeColor, direction, gamePhase, winner,
    scores, roundScores, roundNumber, unoCallWindow,
    aiThinking, drawnCard, pendingWild4Player,
    initializeGame, playCard, drawCard, playDrawnCard,
    passAfterDraw, callUno, catchUno, pickColor,
    challengeWild4, resetGame,
  } = useGameStore();

  // ── Sound integration (lazy import to avoid SSR issues) ──
  async function snd(fn: string, ...args: unknown[]) {
    if (mutedRef.current) return;
    try {
      const sounds = await import("@/lib/sounds");
      (sounds as Record<string, (...a: unknown[]) => void>)[fn]?.(...args);
    } catch { /* ignore */ }
  }

  // Fire sounds reactively
  const prevPhase    = useRef(gamePhase);
  const prevTopCard  = useRef(discardPile[discardPile.length - 1]);
  const prevWinner   = useRef(winner);

  useEffect(() => {
    const topCard = discardPile[discardPile.length - 1];

    // Card played
    if (topCard && topCard !== prevTopCard.current) {
      const v = topCard.value;
      if (v === "wild" || v === "wild4") snd("playWild");
      else snd("playCardPlay", topCard.color);
      prevTopCard.current = topCard;
    }

    // Phase transitions
    if (gamePhase !== prevPhase.current) {
      if (gamePhase === "challenge") snd("playChallenge");
      if (gamePhase === "drawnCard") snd("playCardDraw");
      prevPhase.current = gamePhase;
    }

    // Win/Lose
    if (winner && winner !== prevWinner.current) {
      if (winner === "You") snd("playWin");
      else snd("playLose");
      prevWinner.current = winner;
    }
  });

  useEffect(() => {
    initializeGame(difficulty);
    snd("playShuffle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const human   = players[0];
  const ai      = players[1];
  const topCard = discardPile[discardPile.length - 1];
  const isHumanTurn = currentPlayer === 0;
  const isInteractive = isHumanTurn && (gamePhase === "playing" || gamePhase === "drawnCard");

  const playableIds = new Set<string>(
    isHumanTurn && gamePhase === "playing" && topCard
      ? (human?.cards ?? []).filter(c => canPlayCard(c, topCard, activeColor)).map(c => c.id)
      : []
  );

  const canCatchAi = ai && ai.cards.length === 1 && !ai.saidUno && gamePhase === "playing";
  const humanScore      = scores["human"] ?? 0;
  const humanRoundScore = roundScores["human"] ?? 0;
  const wild4PlayerName = pendingWild4Player !== null
    ? (players[pendingWild4Player]?.name ?? "Opponent") : "Opponent";

  function handlePlayCard(cardId: string) {
    if (isHumanTurn && gamePhase === "playing") {
      playCard(0, cardId);
    }
  }

  function handleDrawCard() {
    drawCard(0);
    snd("playCardDraw");
  }

  function handlePlayAgain() {
    useGameStore.setState(s => ({ roundNumber: s.roundNumber + 1, winner: null }));
    setTimeout(() => {
      snd("playShuffle");
      initializeGame(difficulty);
    }, 80);
  }

  function handleMainMenu() {
    resetGame();
    router.push("/");
  }

  function handleCallUno() {
    callUno(0);
    snd("playUnoCall");
  }

  function handleCatchUno() {
    catchUno(1);
    snd("playPenalty");
  }

  return (
    <div className="table-bg min-h-screen flex flex-col overflow-hidden select-none" style={{ position: "relative", zIndex: 0 }}>

      {/* ── Top bar ── */}
      <div style={{
        position: "relative", zIndex: 2,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 16px",
        background: "rgba(0,0,0,0.35)",
        backdropFilter: "blur(8px)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        flexShrink: 0,
      }}>
        <h1 style={{
          fontFamily: "'Nunito', sans-serif",
          fontWeight: 900, fontSize: 22,
          letterSpacing: 6,
          background: "linear-gradient(135deg, #e53e3e, #d69e2e, #38a169, #3182ce)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.6))",
        }}>UNO</h1>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: 700 }}>
            Round {roundNumber}
          </span>
          <motion.div
            key={humanScore}
            initial={{ scale: 1.3 }}
            animate={{ scale: 1 }}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 20,
              padding: "3px 12px",
              color: "#fbbf24",
              fontSize: 13,
              fontWeight: 900,
            }}
          >
            🏆 {humanScore} pts
          </motion.div>

          {/* Mute button */}
          <button
            onClick={() => { mutedRef.current = !mutedRef.current; }}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 20, padding: "3px 10px",
              color: "rgba(255,255,255,0.55)", fontSize: 16, cursor: "pointer",
            }}
            title="Toggle sound"
            aria-label="Toggle sound"
          >🔊</button>
        </div>
      </div>

      {/* ── AI hand ── */}
      <div style={{ paddingTop: 10, paddingBottom: 6, flexShrink: 0, position: "relative", zIndex: 2 }}>
        {ai && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 2 }}>
                AI — {ai.cards.length} card{ai.cards.length !== 1 ? "s" : ""}
              </span>
              <AnimatePresence>
                {ai.cards.length === 1 && ai.saidUno && (
                  <motion.span
                    initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                    style={{ color: "#fbbf24", fontSize: 11, fontWeight: 900 }}
                    className="animate-pulse"
                  >UNO! 🃏</motion.span>
                )}
                {aiThinking && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="ai-thinking"
                    style={{
                      borderRadius: 12, padding: "2px 10px",
                      fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.7)",
                    }}
                  >thinking...</motion.div>
                )}
              </AnimatePresence>
            </div>
            <PlayerHand cards={ai.cards} isOpponent />
          </div>
        )}
      </div>

      {/* ── Game info bar ── */}
      {(gamePhase === "playing" || gamePhase === "drawnCard") && (
        <div style={{ paddingBottom: 4, flexShrink: 0, position: "relative", zIndex: 2 }}>
          <GameInfo
            currentPlayer={players[currentPlayer]?.name ?? ""}
            direction={direction}
            activeColor={activeColor}
            aiThinking={aiThinking}
          />
        </div>
      )}

      {/* ── Table felt surface ── */}
      <div style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        zIndex: 1,
      }}>
        {/* Felt oval */}
        <div style={{
          position: "absolute",
          width: "min(520px, 88vw)",
          height: "min(180px, 28vw)",
          borderRadius: "50%",
          background: "radial-gradient(ellipse at center, rgba(32,135,77,0.55) 0%, rgba(15,74,39,0.35) 70%, transparent 100%)",
          border: "2px solid rgba(255,255,255,0.06)",
          boxShadow: "inset 0 0 40px rgba(0,0,0,0.25), 0 0 40px rgba(0,0,0,0.2)",
          pointerEvents: "none",
        }} />

        {/* Draw pile + Discard pile */}
        <div style={{ display: "flex", gap: 48, alignItems: "center", position: "relative", zIndex: 2 }}>
          <DrawPile
            count={drawPile.length}
            canDraw={isInteractive && gamePhase === "playing"}
            onClick={handleDrawCard}
          />
          <DiscardPile topCard={topCard ?? null} activeColor={activeColor} />
        </div>
      </div>

      {/* ── Human hand ── */}
      <div style={{ paddingBottom: 12, flexShrink: 0, position: "relative", zIndex: 2 }}>
        {human && (
          <PlayerHand
            cards={human.cards}
            playableIds={isHumanTurn && gamePhase === "playing" ? playableIds : new Set()}
            onPlay={handlePlayCard}
            label="Your Hand"
          />
        )}
      </div>

      {/* ── Overlays ── */}

      <ColorPicker
        isOpen={gamePhase === "pickColor" &&
          (pendingWild4Player === null || players[pendingWild4Player]?.isHuman === true)}
        onPick={pickColor}
      />

      <ChallengeModal
        isOpen={gamePhase === "challenge"}
        wild4PlayerName={wild4PlayerName}
        onChallenge={() => { snd("playChallenge"); challengeWild4(true); }}
        onAccept={() => challengeWild4(false)}
      />

      <DrawnCardBanner
        isOpen={gamePhase === "drawnCard" && isHumanTurn}
        card={drawnCard}
        onPlay={playDrawnCard}
        onPass={passAfterDraw}
      />

      <UnoButton
        visible={unoCallWindow && isHumanTurn}
        onCall={handleCallUno}
        canCatch={canCatchAi}
        onCatch={handleCatchUno}
      />

      <WinScreen
        winner={winner}
        roundScore={humanRoundScore}
        totalScore={humanScore}
        roundNumber={roundNumber}
        onPlayAgain={handlePlayAgain}
        onMainMenu={handleMainMenu}
      />

      <ToastContainer />
    </div>
  );
}
