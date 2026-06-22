"use client";

import { useEffect } from "react";
import { useGameStore } from "@/store/gameStore";
import { canPlayCard } from "@/lib/gameEngine";
import PlayerHand from "./PlayerHand";
import DrawPile from "./DrawPile";
import DiscardPile from "./DiscardPile";
import ColorPicker from "./ColorPicker";
import UnoButton from "./UnoButton";
import WinScreen from "./WinScreen";
import GameInfo from "./GameInfo";

interface Props {
  difficulty?: "easy" | "medium" | "hard";
}

export default function GameBoard({ difficulty = "medium" }: Props) {
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
    unoCallWindow,
    aiThinking,
    initializeGame,
    playCard,
    drawCard,
    callUno,
    pickColor,
    resetGame,
  } = useGameStore();

  useEffect(() => {
    initializeGame(difficulty);
  }, []);

  const human = players[0];
  const ai = players[1];
  const topCard = discardPile[discardPile.length - 1];
  const isHumanTurn = currentPlayer === 0;

  // Compute playable card IDs for human
  const playableIds = new Set<string>(
    isHumanTurn && topCard
      ? (human?.cards ?? []).filter((c) => canPlayCard(c, topCard, activeColor)).map((c) => c.id)
      : []
  );

  const humanScore = scores["human"] ?? 0;

  function handlePlayAgain() {
    resetGame();
    setTimeout(() => initializeGame(difficulty), 100);
  }

  return (
    <div className="felt-texture min-h-screen flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/20">
        <h1 className="text-2xl font-black text-white tracking-widest">UNO</h1>
        <div className="text-white/60 text-sm font-bold">Score: {humanScore}</div>
      </div>

      {/* AI hand */}
      <div className="pt-4 pb-2">
        {ai && (
          <div className="flex flex-col items-center gap-1">
            <p className="text-white/50 text-xs font-bold uppercase tracking-wider">
              AI — {ai.cards.length} card{ai.cards.length !== 1 ? "s" : ""}
              {ai.cards.length === 1 && <span className="ml-2 text-yellow-400">says UNO!</span>}
            </p>
            <PlayerHand cards={ai.cards} isOpponent />
          </div>
        )}
      </div>

      {/* Game info bar */}
      {gamePhase === "playing" && (
        <div className="py-2">
          <GameInfo
            currentPlayer={players[currentPlayer]?.name ?? ""}
            direction={direction}
            activeColor={activeColor}
            aiThinking={aiThinking}
          />
        </div>
      )}

      {/* Center play area */}
      <div className="flex-1 flex items-center justify-center gap-12">
        <DrawPile
          count={drawPile.length}
          canDraw={isHumanTurn && gamePhase === "playing"}
          onClick={() => drawCard(0)}
        />
        <DiscardPile topCard={topCard ?? null} activeColor={activeColor} />
      </div>

      {/* Human hand */}
      <div className="pb-4">
        {human && (
          <PlayerHand
            cards={human.cards}
            playableIds={isHumanTurn ? playableIds : new Set()}
            onPlay={(cardId) => {
              if (isHumanTurn && gamePhase === "playing") {
                playCard(0, cardId);
              }
            }}
            label="Your Hand"
          />
        )}
      </div>

      {/* Modals */}
      <ColorPicker
        isOpen={gamePhase === "pickColor"}
        onPick={pickColor}
      />

      <UnoButton
        visible={unoCallWindow && isHumanTurn}
        onCall={() => callUno(0)}
      />

      <WinScreen
        winner={winner}
        score={humanScore}
        onPlayAgain={handlePlayAgain}
      />
    </div>
  );
}
