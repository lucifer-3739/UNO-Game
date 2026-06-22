"use client";

import { useSearchParams } from "next/navigation";
import GameBoard from "@/components/GameBoard";
import type { Difficulty } from "@/types/uno";
import { Suspense } from "react";

function GamePage() {
  const searchParams = useSearchParams();
  const difficulty = (searchParams.get("difficulty") ?? "medium") as Difficulty;

  return <GameBoard difficulty={difficulty} />;
}

export default function Game() {
  return (
    <Suspense fallback={
      <div className="felt-texture min-h-screen flex items-center justify-center">
        <p className="text-white text-2xl font-black">Loading...</p>
      </div>
    }>
      <GamePage />
    </Suspense>
  );
}
