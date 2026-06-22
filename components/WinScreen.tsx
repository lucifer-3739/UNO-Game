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
}

const COLORS = ["#dc2626", "#2563eb", "#16a34a", "#ca8a04", "#ffffff", "#f97316"];

function Confetti() {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([]);

  useEffect(() => {
    const generated = Array.from({ length: 60 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      delay: Math.random() * 2,
      duration: 2 + Math.random() * 3,
      size: 6 + Math.random() * 8,
    }));
    setPieces(generated);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
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
            borderRadius: Math.random() > 0.5 ? "50%" : "0",
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
  score: number;
  onPlayAgain: () => void;
}

export default function WinScreen({ winner, score, onPlayAgain }: Props) {
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
            className="fixed inset-0 z-40 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.85)" }}
          >
            <motion.div
              initial={{ scale: 0.5, y: 60 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.5, y: 60 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="flex flex-col items-center gap-6 text-center px-8"
            >
              <motion.div
                animate={{ rotate: [0, -5, 5, -5, 0] }}
                transition={{ delay: 0.4, duration: 0.6 }}
              >
                <span className="text-8xl">{isHuman ? "🎉" : "🤖"}</span>
              </motion.div>

              <div>
                <h1 className="text-5xl font-black text-white">
                  {isHuman ? "You Win!" : "AI Wins!"}
                </h1>
                <p className="text-white/70 text-lg mt-2">
                  {isHuman
                    ? `You scored ${score} points this round!`
                    : "Better luck next time!"}
                </p>
              </div>

              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
                onClick={onPlayAgain}
                className="px-10 py-4 rounded-2xl font-black text-xl text-white shadow-2xl"
                style={{ background: "linear-gradient(135deg, #16a34a, #166534)" }}
                aria-label="Play again"
              >
                Play Again
              </motion.button>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
