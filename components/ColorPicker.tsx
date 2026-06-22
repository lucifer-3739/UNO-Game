"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Color } from "@/types/uno";

interface Props {
  isOpen: boolean;
  onPick: (color: Color) => void;
}

const COLORS: { color: Color; bg: string; label: string }[] = [
  { color: "red", bg: "#dc2626", label: "Red" },
  { color: "blue", bg: "#2563eb", label: "Blue" },
  { color: "green", bg: "#16a34a", label: "Green" },
  { color: "yellow", bg: "#ca8a04", label: "Yellow" },
];

export default function ColorPicker({ isOpen, onPick }: Props) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.75)" }}
        >
          <motion.div
            initial={{ scale: 0.7, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.7, y: 30 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            className="bg-white/10 backdrop-blur-md rounded-3xl p-8 flex flex-col items-center gap-6 shadow-2xl border border-white/20"
          >
            <h2 className="text-2xl font-black text-white">Choose a Color</h2>
            <div className="grid grid-cols-2 gap-4">
              {COLORS.map(({ color, bg, label }) => (
                <motion.button
                  key={color}
                  whileHover={{ scale: 1.12, y: -4 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onPick(color)}
                  className="w-28 h-28 rounded-2xl font-black text-white text-lg shadow-lg border-4 border-white/50 flex items-center justify-center"
                  style={{ background: bg }}
                  aria-label={`Pick ${label}`}
                >
                  {label}
                </motion.button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
