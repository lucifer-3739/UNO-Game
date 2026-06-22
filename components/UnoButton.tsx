"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

interface Props {
  visible: boolean;
  onCall: () => void;
  /** Optional: show a "Catch!" button to penalise opponent who forgot UNO */
  canCatch?: boolean;
  onCatch?: () => void;
}

export default function UnoButton({ visible, onCall, canCatch = false, onCatch }: Props) {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (!visible) {
      setCountdown(5);
      return;
    }
    setCountdown(5);
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          // Auto-call UNO to avoid penalty — actual penalty enforcement
          // is handled by the store's catchUno flow triggered by opponent
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [visible]);

  return (
    <AnimatePresence>
      {/* UNO Call button */}
      {visible && (
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          exit={{ scale: 0, rotate: 20 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          className="fixed bottom-28 right-4 z-40 flex flex-col items-center gap-1"
        >
          <motion.button
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            onClick={onCall}
            className="uno-glow w-20 h-20 rounded-full font-black text-xl text-white shadow-2xl border-4 border-yellow-300 flex flex-col items-center justify-center"
            style={{ background: "linear-gradient(135deg, #dc2626, #7f1d1d)" }}
            aria-label="Call UNO"
          >
            <span>UNO!</span>
            <span className="text-xs font-bold text-yellow-200">{countdown}s</span>
          </motion.button>
        </motion.div>
      )}

      {/* Catch opponent button */}
      {canCatch && onCatch && (
        <motion.button
          key="catch"
          initial={{ scale: 0, rotate: 20 }}
          animate={{ scale: 1, rotate: 0 }}
          exit={{ scale: 0, rotate: -20 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          whileHover={{ scale: 1.12 }}
          whileTap={{ scale: 0.9 }}
          onClick={onCatch}
          className="fixed bottom-28 left-4 z-40 w-20 h-20 rounded-full font-black text-sm text-white shadow-2xl border-4 border-orange-400 flex flex-col items-center justify-center gap-0.5"
          style={{ background: "linear-gradient(135deg, #ea580c, #7c2d12)" }}
          aria-label="Catch opponent who forgot UNO"
        >
          <span className="text-lg">🎣</span>
          <span>Catch!</span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
