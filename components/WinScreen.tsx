"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

interface ConfettiPiece {
  id: number;
  left: number;
  color: string;
  delay: number;
  duration: number;
  size: number;
  shape: "circle" | "square";
}

const COLORS = ["#dc2626", "#2563eb", "#16a34a", "#ca8a04", "#ffffff", "#f97316", "#a855f7"];

function Confetti() {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    const generated = Array.from({ length: 80 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      delay: Math.random() * 2.5,
      duration: 2.5 + Math.random() * 3,
      size: 6 + Math.random() * 10,
      shape: (Math.random() > 0.5 ? "circle" : "square") as "circle" | "square",
    }));
    setPieces(generated);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            top: 0,
            background: p.color,
            width: p.size,
            height: p.size,
            borderRadius: p.shape === "circle" ? "50%" : "2px",
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

interface Props {
  winner: string | null;
  roundScore: number;
  totalScore: number;
  roundNumber: number;
  onPlayAgain: () => void;
  onMainMenu: () => void;
}

export default function WinScreen({
  winner,
  roundScore,
  totalScore,
  roundNumber,
  onPlayAgain,
  onMainMenu,
}: Props) {
  const isHuman = winner === "You";

  return (
    <AnimatePresence>
      {winner && (
        <>
          {isHuman && <Confetti />}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto py-8"
            style={{ background: "rgba(0,0,0,0.88)" }}
          >
            <motion.div
              initial={{ scale: 0.5, y: 60 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.5, y: 60 }}
              transition={{ type: "spring", stiffness: 280, damping: 24 }}
              className="flex flex-col items-center gap-5 text-center px-8 max-w-sm w-full"
            >
              {/* Emoji */}
              <motion.div
                animate={{ rotate: [0, -8, 8, -8, 0] }}
                transition={{ delay: 0.4, duration: 0.7 }}
              >
                <span className="text-8xl">{isHuman ? "🎉" : "🤖"}</span>
              </motion.div>

              {/* Headline */}
              <div>
                <h1 className="text-5xl font-black text-white">
                  {isHuman ? "You Win!" : "AI Wins!"}
                </h1>
                <p className="text-white/60 text-base mt-1">Round {roundNumber}</p>
              </div>

              {/* Score card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="w-full bg-white/10 rounded-2xl p-4 border border-white/20 flex flex-col gap-2"
              >
                <div className="flex justify-between items-center text-white">
                  <span className="text-sm font-bold text-white/60">Round points</span>
                  <span className="text-2xl font-black text-yellow-300">+{roundScore}</span>
                </div>
                <div className="h-px bg-white/10" />
                <div className="flex justify-between items-center text-white">
                  <span className="text-sm font-bold text-white/60">Total score</span>
                  <span className="text-2xl font-black">{totalScore}</span>
                </div>
                {!isHuman && (
                  <p className="text-white/40 text-xs mt-1">
                    Better luck next round!
                  </p>
                )}
              </motion.div>

              {/* Scoring legend */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="w-full bg-white/5 rounded-xl p-3 grid grid-cols-3 gap-2 text-white/50 text-xs"
              >
                <div className="text-center">
                  <div className="font-black text-white/70">0–9</div>
                  <div>face value</div>
                </div>
                <div className="text-center">
                  <div className="font-black text-white/70">20 pts</div>
                  <div>action cards</div>
                </div>
                <div className="text-center">
                  <div className="font-black text-white/70">50 pts</div>
                  <div>wild cards</div>
                </div>
              </motion.div>

              {/* Buttons */}
              <div className="flex gap-3 w-full">
                <motion.button
                  whileHover={{ scale: 1.06, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onPlayAgain}
                  className="flex-1 py-4 rounded-2xl font-black text-lg text-white shadow-2xl"
                  style={{ background: "linear-gradient(135deg, #16a34a, #166534)" }}
                  aria-label="Play next round"
                >
                  Next Round ▶
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.06, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onMainMenu}
                  className="py-4 px-5 rounded-2xl font-black text-white/70 text-sm border border-white/20"
                  style={{ background: "rgba(255,255,255,0.07)" }}
                  aria-label="Return to main menu"
                >
                  🏠 Menu
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
