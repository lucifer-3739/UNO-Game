"use client";

import { motion } from "framer-motion";
import Card from "./Card";

interface Props {
  count: number;
  onClick?: () => void;
  canDraw?: boolean;
}

export default function DrawPile({ count, onClick, canDraw = false }: Props) {
  const fakeCard = { id: "back", color: null as null, value: 0 as const };

  return (
    <div className="flex flex-col items-center gap-2">
      <motion.div
        className="relative cursor-pointer"
        whileHover={canDraw ? { scale: 1.05, y: -4 } : {}}
        whileTap={canDraw ? { scale: 0.95 } : {}}
        onClick={canDraw ? onClick : undefined}
        title={canDraw ? "Draw a card" : ""}
      >
        {/* Stack depth effect */}
        {[4, 3, 2, 1].map((offset) => (
          <div
            key={offset}
            className="absolute rounded-xl"
            style={{
              width: 80,
              height: 112,
              background: "#1e1b4b",
              border: "4px solid white",
              top: -offset * 2,
              left: -offset,
              opacity: 0.6 + offset * 0.08,
              borderRadius: 12,
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            }}
          />
        ))}
        <Card card={fakeCard} isBack />
        {canDraw && (
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg">
            <span className="text-xs font-black text-yellow-900">+</span>
          </div>
        )}
      </motion.div>
      <p className="text-white/60 text-xs font-bold">{count} left</p>
    </div>
  );
}