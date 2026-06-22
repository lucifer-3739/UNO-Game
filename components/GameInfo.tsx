"use client";

import { motion } from "framer-motion";
import { Color } from "@/types/uno";

interface Props {
  currentPlayer: string;
  direction: 1 | -1;
  activeColor: Color | null;
  aiThinking: boolean;
}

const COLOR_BG: Record<string, string> = {
  red: "#dc2626",
  blue: "#2563eb",
  green: "#16a34a",
  yellow: "#ca8a04",
};

export default function GameInfo({ currentPlayer, direction, activeColor, aiThinking }: Props) {
  return (
    <div className="flex items-center justify-center gap-4 flex-wrap">
      {/* Direction */}
      <motion.div
        key={direction}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex items-center gap-1 bg-white/10 rounded-full px-3 py-1"
      >
        <span className="text-white/60 text-xs font-bold">Direction</span>
        <motion.span
          animate={{ rotate: direction === 1 ? 0 : 180 }}
          transition={{ type: "spring", stiffness: 300 }}
          className="text-white text-lg"
        >
          ↻
        </motion.span>
      </motion.div>

      {/* Active color */}
      {activeColor && (
        <motion.div
          key={activeColor}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex items-center gap-2 bg-white/10 rounded-full px-3 py-1"
        >
          <div
            className="w-4 h-4 rounded-full border-2 border-white/50"
            style={{ background: COLOR_BG[activeColor] }}
          />
          <span className="text-white/60 text-xs font-bold capitalize">{activeColor}</span>
        </motion.div>
      )}

      {/* Turn indicator */}
      <motion.div
        key={currentPlayer}
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center gap-2 bg-white/10 rounded-full px-3 py-1"
      >
        {aiThinking && (
          <div className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse" />
        )}
        <span className="text-white/80 text-xs font-bold">
          {aiThinking ? "AI is thinking..." : `${currentPlayer}'s turn`}
        </span>
      </motion.div>
    </div>
  );
}
