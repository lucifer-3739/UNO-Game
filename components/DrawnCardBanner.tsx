"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Card as UnoCard } from "@/types/uno";
import Card from "./Card";

interface Props {
  isOpen: boolean;
  card: UnoCard | null;
  onPlay: () => void;
  onPass: () => void;
}

export default function DrawnCardBanner({ isOpen, card, onPlay, onPass }: Props) {
  return (
    <AnimatePresence>
      {isOpen && card && (
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 60 }}
          transition={{ type: "spring", stiffness: 350, damping: 28 }}
          className="fixed bottom-36 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-3"
        >
          <div
            className="bg-white/10 backdrop-blur-md rounded-3xl px-6 py-4 flex flex-col items-center gap-4 shadow-2xl border border-white/20"
          >
            <p className="text-white font-black text-sm uppercase tracking-widest">
              You drew — play it?
            </p>
            <Card card={card} />
            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.06, y: -2 }}
                whileTap={{ scale: 0.94 }}
                onClick={onPlay}
                className="px-6 py-2.5 rounded-xl font-black text-white text-sm shadow-lg"
                style={{ background: "linear-gradient(135deg, #16a34a, #166534)" }}
                aria-label="Play drawn card"
              >
                ▶ Play It
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.06, y: -2 }}
                whileTap={{ scale: 0.94 }}
                onClick={onPass}
                className="px-6 py-2.5 rounded-xl font-black text-white/70 text-sm shadow-lg border border-white/20"
                style={{ background: "rgba(255,255,255,0.1)" }}
                aria-label="Pass turn after drawing"
              >
                ⏭ Pass
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
