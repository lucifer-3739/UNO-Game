"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Card as UnoCard, Color } from "@/types/uno";
import Card from "./Card";

interface Props {
  topCard: UnoCard | null;
  activeColor: Color | null;
}

const COLOR_GLOW: Record<string, string> = {
  red:    "0 0 30px rgba(229,62,62,0.7),    0 0 60px rgba(229,62,62,0.3)",
  blue:   "0 0 30px rgba(49,130,206,0.7),   0 0 60px rgba(49,130,206,0.3)",
  green:  "0 0 30px rgba(56,161,105,0.7),   0 0 60px rgba(56,161,105,0.3)",
  yellow: "0 0 30px rgba(214,158,46,0.7),   0 0 60px rgba(214,158,46,0.3)",
};

const COLOR_DOT: Record<string, string> = {
  red:    "#e53e3e",
  blue:   "#3182ce",
  green:  "#38a169",
  yellow: "#d69e2e",
};

export default function DiscardPile({ topCard, activeColor }: Props) {
  const glow = activeColor ? COLOR_GLOW[activeColor] : undefined;

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Glow ring + card */}
      <motion.div
        animate={{ boxShadow: glow ?? "0 0 0px transparent" }}
        transition={{ duration: 0.4 }}
        style={{ borderRadius: 18, padding: 4 }}
      >
        <AnimatePresence mode="wait">
          {topCard ? (
            <motion.div
              key={topCard.id}
              initial={{ rotateY: 90, scale: 0.85, opacity: 0.6 }}
              animate={{ rotateY: 0,  scale: 1,    opacity: 1   }}
              exit={{    rotateY: -90, scale: 0.8,  opacity: 0   }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              style={{ transformOrigin: "center", perspective: "600px" }}
            >
              <Card card={topCard} />
            </motion.div>
          ) : (
            <div style={{
              width: 80, height: 112,
              borderRadius: 14,
              border: "2px dashed rgba(255,255,255,0.25)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 11 }}>Discard</span>
            </div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Active color pill */}
      <AnimatePresence mode="wait">
        {activeColor && (
          <motion.div
            key={activeColor}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1,   opacity: 1 }}
            exit={{    scale: 0.7, opacity: 0 }}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              background: "rgba(0,0,0,0.35)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 20,
              padding: "3px 10px",
            }}
          >
            <motion.div
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
              style={{
                width: 10, height: 10, borderRadius: "50%",
                background: COLOR_DOT[activeColor] ?? "#fff",
                boxShadow: `0 0 6px ${COLOR_DOT[activeColor] ?? "#fff"}`,
              }}
            />
            <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.7)", textTransform: "capitalize" }}>
              {activeColor}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
