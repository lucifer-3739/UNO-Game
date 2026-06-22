"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Card as UnoCard, Color } from "@/types/uno";
import Card from "./Card";

interface Props {
  topCard: UnoCard | null;
  activeColor: Color | null;
}

const COLOR_RING: Record<string, string> = {
  red: "ring-red-400",
  blue: "ring-blue-400",
  green: "ring-green-400",
  yellow: "ring-yellow-400",
};

export default function DiscardPile({ topCard, activeColor }: Props) {
  const ring = activeColor ? COLOR_RING[activeColor] : "";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`rounded-2xl p-1 ${ring ? `ring-4 ${ring}` : ""} transition-all duration-300`}>
        <AnimatePresence mode="wait">
          {topCard ? (
            <motion.div
              key={topCard.id}
              initial={{ rotateY: 90, scale: 0.8 }}
              animate={{ rotateY: 0, scale: 1 }}
              exit={{ rotateY: -90, scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              style={{ transformOrigin: "center" }}
            >
              <Card card={topCard} />
            </motion.div>
          ) : (
            <div className="w-20 h-28 rounded-xl border-4 border-dashed border-white/30 flex items-center justify-center">
              <span className="text-white/30 text-xs">Empty</span>
            </div>
          )}
        </AnimatePresence>
      </div>
      {activeColor && (
        <p className="text-white/60 text-xs font-bold capitalize">Color: {activeColor}</p>
      )}
    </div>
  );
}
