"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import type { Difficulty } from "@/types/uno";

const DIFFICULTIES: { key: Difficulty; label: string; desc: string; emoji: string }[] = [
  { key: "easy", label: "Easy", desc: "Random valid cards", emoji: "😊" },
  { key: "medium", label: "Medium", desc: "Basic strategy", emoji: "🧠" },
  { key: "hard", label: "Hard", desc: "Expert play", emoji: "🔥" },
];

export default function Home() {
  const [selected, setSelected] = useState<Difficulty>("medium");
  const router = useRouter();

  function startGame() {
    router.push(`/game?difficulty=${selected}`);
  }

  return (
    <div
      className="felt-texture min-h-screen flex flex-col items-center justify-center gap-10 px-6"
    >
      {/* Logo */}
      <motion.div
        initial={{ scale: 0, rotate: -15 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="text-center"
      >
        <motion.h1
          animate={{ y: [0, -8, 0] }}
          transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          className="text-9xl font-black tracking-widest"
          style={{
            background: "linear-gradient(135deg, #dc2626, #ca8a04, #16a34a, #2563eb)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.5))",
          }}
        >
          UNO
        </motion.h1>
        <p className="text-white/50 text-lg font-bold mt-2">The classic card game</p>
      </motion.div>

      {/* Difficulty */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex flex-col items-center gap-4 w-full max-w-sm"
      >
        <p className="text-white/70 font-bold uppercase tracking-widest text-sm">Select Difficulty</p>
        <div className="grid grid-cols-3 gap-3 w-full">
          {DIFFICULTIES.map(({ key, label, desc, emoji }) => (
            <motion.button
              key={key}
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelected(key)}
              className={`
                flex flex-col items-center gap-1 p-4 rounded-2xl border-2 font-bold transition-all duration-200
                ${selected === key
                  ? "border-yellow-400 bg-yellow-400/20 text-yellow-300"
                  : "border-white/20 bg-white/5 text-white/70 hover:border-white/40"
                }
              `}
              aria-pressed={selected === key}
              aria-label={`${label} difficulty — ${desc}`}
            >
              <span className="text-2xl">{emoji}</span>
              <span className="text-sm font-black">{label}</span>
              <span className="text-xs opacity-70">{desc}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Start button */}
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        whileHover={{ scale: 1.08, y: -3 }}
        whileTap={{ scale: 0.95 }}
        onClick={startGame}
        className="px-14 py-5 rounded-3xl font-black text-2xl text-white shadow-2xl"
        style={{ background: "linear-gradient(135deg, #dc2626, #7f1d1d)" }}
        aria-label="Start game"
      >
        Play Now!
      </motion.button>

      {/* Rules summary */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="text-center text-white/40 text-xs max-w-xs leading-relaxed"
      >
        Match the color or number of the top card. Wild cards can be played anytime.
        First to empty their hand wins!
      </motion.div>
    </div>
  );
}
