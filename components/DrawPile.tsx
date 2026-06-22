"use client";

import { motion } from "framer-motion";
import Card from "./Card";

interface Props {
  count: number;
  onClick?: () => void;
  canDraw?: boolean;
}

const FAKE_CARD = { id: "back", color: null as null, value: 0 as const };

export default function DrawPile({ count, onClick, canDraw = false }: Props) {
  // Stack layers (bottom to top)
  const layers = [5, 4, 3, 2, 1];

  return (
    <div className="flex flex-col items-center gap-2">
      <motion.div
        className="relative cursor-pointer"
        style={{ width: 80, height: 112 }}
        whileHover={canDraw ? { scale: 1.06, y: -6 } : {}}
        whileTap={canDraw ? { scale: 0.96 } : {}}
        onClick={canDraw ? onClick : undefined}
        title={canDraw ? "Draw a card" : ""}
      >
        {/* 3D stacked depth layers */}
        {layers.map((offset) => (
          <div
            key={offset}
            className="draw-stack-layer"
            style={{
              width: 80, height: 112,
              top:  -(offset * 2),
              left: -(offset * 0.8),
              opacity: 0.5 + offset * 0.09,
              boxShadow: offset === 1
                ? "0 6px 20px rgba(0,0,0,0.6)"
                : "none",
            }}
          />
        ))}

        {/* Top card (card back) */}
        <div style={{ position: "absolute", inset: 0 }}>
          <Card card={FAKE_CARD} isBack />
        </div>

        {/* Draw indicator badge */}
        {canDraw && (
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
            style={{
              position: "absolute",
              bottom: -8, right: -8,
              width: 24, height: 24,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #fbbf24, #d97706)",
              border: "2px solid rgba(255,255,255,0.8)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: 10,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 900, color: "#1a0800" }}>+</span>
          </motion.div>
        )}
      </motion.div>

      <p style={{
        color: "rgba(255,255,255,0.5)",
        fontSize: 11,
        fontWeight: 700,
        marginTop: 4,
      }}>
        {count} left
      </p>
    </div>
  );
}