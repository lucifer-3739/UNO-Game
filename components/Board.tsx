"use client";

import { useEffect } from "react";
import { useGameStore } from "@/store/gameStore";
import Card from "./Card";

export default function Board() {
  const { initializeGame, players, discardPile, playCard } = useGameStore();
  const drawCard = useGameStore((state) => state.drawCard);

  useEffect(() => {
    initializeGame();
  }, []);

  const topCard = discardPile[discardPile.length - 1];

  return (
    <div className="min-h-screen bg-green-900 p-8">
      <div className="text-center text-white">
        <h1 className="text-4xl font-bold">UNO</h1>

        <div className="flex justify-center my-10">
          {topCard && <Card card={topCard} />}
        </div>

        <button
          onClick={() => drawCard(0)}
          className="
            px-4 py-2
            bg-white
            rounded-lg
            font-bold
          "
        >
          Draw Card
        </button>

        <div>
          AI Cards:
          {players[1]?.cards.length}
        </div>

        <div className="flex gap-2 flex-wrap justify-center mt-8">
          {players[0]?.cards.map((card) => (
            <Card
              key={card.id}
              card={card}
              onClick={() => playCard(0, card.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
