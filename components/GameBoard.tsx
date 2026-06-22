"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/gameStore";
import { canPlayCard } from "@/lib/gameEngine";
import PlayerHand from "./PlayerHand";
import DrawPile from "./DrawPile";
import DiscardPile from "./DiscardPile";
import ColorPicker from "./ColorPicker";
import UnoButton from "./UnoButton";
import WinScreen from "./WinScreen";
import GameInfo from "./GameInfo";
import ChallengeModal from "./ChallengeModal";
import DrawnCardBanner from "./DrawnCardBanner";
import ToastContainer from "./Toast";

interface Props {
  difficulty?: "easy" | "medium" | "hard";
}

export default function GameBoard({ difficulty = "medium" }: Props) {
  const router = useRouter();

  const {
    players,
    currentPlayer,
    drawPile,
    discardPile,
    activeColor,
    direction,
    gamePhase,
    winner,
    scores,
    roundScores,
    roundNumber,
    unoCallWindow,
    aiThinking,
    drawnCard,
    pendingWild4Player,
    initializeGame,
    playCard,
    drawCard,
    playDrawnCard,
    passAfterDraw,
    callUno,
    catchUno,
    pickColor,
    challengeWild4,
    resetGame,
  } = useGameStore();

  useEffect(() => {
    initializeGame(difficulty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const human = players[0];
  const ai    = players[1];
  const topCard = discardPile[discardPile.length - 1];
  const isHumanTurn = currentPlayer === 0;
  const isInteractive = isHumanTurn && (gamePhase === "playing" || gamePhase === "drawnCard");

  // Playable card IDs for human
  const playableIds = new Set<string>(
    isHumanTurn && gamePhase === "playing" && topCard
      ? (human?.cards ?? [])
          .filter((c) => canPlayCard(c, topCard, activeColor))
          .map((c) => c.id)
      : []
  );

  // Human can catch AI that forgot UNO (AI has 1 card, didn't say UNO)
  const canCatchAi =
    ai &&
    ai.cards.length === 1 &&
    !ai.saidUno &&
    gamePhase === "playing";

  const humanScore = scores["human"] ?? 0;
  const humanRoundScore = roundScores["human"] ?? 0;

  // Wild4 player name (for challenge modal)
  const wild4PlayerName =
    pendingWild4Player !== null ? (players[pendingWild4Player]?.name ?? "Opponent") : "Opponent";

  function handlePlayAgain() {
    // Keep scores — just start a new round
    useGameStore.setState((s) => ({ roundNumber: s.roundNumber + 1, winner: null }));
    setTimeout(() => initializeGame(difficulty), 80);
  }

  function handleMainMenu() {
    resetGame();
    router.push("/");
  }

  return (
    <div className="felt-texture min-h-screen flex flex-col overflow-hidden select-none">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/25 backdrop-blur-sm flex-shrink-0">
        <h1 className="text-xl font-black text-white tracking-widest">UNO</h1>
        <div className="flex items-center gap-3">
          <span className="text-white/50 text-xs font-bold">Round {roundNumber}</span>
          <span className="text-yellow-300 font-black text-sm">🏆 {humanScore} pts</span>
        </div>
      </div>

      {/* ── AI hand ── */}
      <div className="pt-3 pb-1 flex-shrink-0">
        {ai && (
          <div className="flex flex-col items-center gap-1">
            <p className="text-white/50 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <span>AI — {ai.cards.length} card{ai.cards.length !== 1 ? "s" : ""}</span>
              {ai.cards.length === 1 && ai.saidUno && (
                <span className="text-yellow-400 animate-pulse">UNO! 🃏</span>
              )}
              {aiThinking && (
                <span className="text-blue-300 animate-pulse">thinking...</span>
              )}
            </p>
            <PlayerHand cards={ai.cards} isOpponent />
          </div>
        )}
      </div>

      {/* ── Game info bar ── */}
      {(gamePhase === "playing" || gamePhase === "drawnCard") && (
        <div className="py-1 flex-shrink-0">
          <GameInfo
            currentPlayer={players[currentPlayer]?.name ?? ""}
            direction={direction}
            activeColor={activeColor}
            aiThinking={aiThinking}
          />
        </div>
      )}

      {/* ── Centre: draw + discard ── */}
      <div className="flex-1 flex items-center justify-center gap-10 sm:gap-16 px-4">
        <DrawPile
          count={drawPile.length}
          canDraw={isInteractive && gamePhase === "playing"}
          onClick={() => drawCard(0)}
        />
        <DiscardPile topCard={topCard ?? null} activeColor={activeColor} />
      </div>

      {/* ── Human hand ── */}
      <div className="pb-3 flex-shrink-0">
        {human && (
          <PlayerHand
            cards={human.cards}
            playableIds={isHumanTurn && gamePhase === "playing" ? playableIds : new Set()}
            onPlay={(cardId) => {
              if (isHumanTurn && gamePhase === "playing") playCard(0, cardId);
            }}
            label="Your Hand"
          />
        )}
      </div>

      {/* ── Modals & overlays ── */}

      {/* Color picker (after playing wild/wild4) */}
      <ColorPicker
        isOpen={gamePhase === "pickColor" && (pendingWild4Player === null || players[pendingWild4Player]?.isHuman === true)}
        onPick={pickColor}
      />

      {/* Challenge modal (AI played wild4) */}
      <ChallengeModal
        isOpen={gamePhase === "challenge"}
        wild4PlayerName={wild4PlayerName}
        onChallenge={() => challengeWild4(true)}
        onAccept={() => challengeWild4(false)}
      />

      {/* Drawn card banner */}
      <DrawnCardBanner
        isOpen={gamePhase === "drawnCard" && isHumanTurn}
        card={drawnCard}
        onPlay={playDrawnCard}
        onPass={passAfterDraw}
      />

      {/* UNO button + Catch button */}
      <UnoButton
        visible={unoCallWindow && isHumanTurn}
        onCall={() => callUno(0)}
        canCatch={canCatchAi}
        onCatch={() => catchUno(1)}
      />

      {/* Win screen */}
      <WinScreen
        winner={winner}
        roundScore={humanRoundScore}
        totalScore={humanScore}
        roundNumber={roundNumber}
        onPlayAgain={handlePlayAgain}
        onMainMenu={handleMainMenu}
      />

      {/* Toast notifications */}
      <ToastContainer />
    </div>
  );
}
