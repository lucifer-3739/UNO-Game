"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import type { Difficulty } from "@/types/uno";

const DIFFICULTIES: { key: Difficulty; label: string; desc: string; color: string; glow: string }[] = [
  { key: "easy",   label: "Easy",   desc: "Casual fun",     color: "#38a169", glow: "rgba(56,161,105,0.6)"  },
  { key: "medium", label: "Medium", desc: "Smart AI",       color: "#d69e2e", glow: "rgba(214,158,46,0.6)"  },
  { key: "hard",   label: "Hard",   desc: "Expert mode",   color: "#e53e3e", glow: "rgba(229,62,62,0.6)"   },
];

// Floating decorative card
function FloatingCard({ color, label, style }: {
  color: string; label: string;
  style: React.CSSProperties;
}) {
  return (
    <motion.div
      animate={{ y: [0, -12, 0], rotate: [0, 2, 0] }}
      transition={{ repeat: Infinity, duration: 4 + Math.random() * 2, ease: "easeInOut" }}
      style={{
        position: "absolute",
        width: 56, height: 80,
        borderRadius: 10,
        background: `linear-gradient(145deg, ${color} 0%, color-mix(in srgb, ${color} 60%, black) 100%)`,
        border: "2px solid rgba(255,255,255,0.25)",
        boxShadow: `0 10px 30px rgba(0,0,0,0.5), 0 0 20px ${color}55`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "white", fontWeight: 900, fontSize: 20,
        fontFamily: "'Nunito', sans-serif",
        textShadow: "0 2px 8px rgba(0,0,0,0.5)",
        pointerEvents: "none",
        zIndex: 0,
        ...style,
      }}
    >
      {label}
    </motion.div>
  );
}

export default function Home() {
  const [selected, setSelected] = useState<Difficulty>("medium");
  const [starting, setStarting] = useState(false);
  const router = useRouter();

  function startGame() {
    setStarting(true);
    setTimeout(() => router.push(`/game?difficulty=${selected}`), 400);
  }

  const decorCards = [
    { color: "#e53e3e", label: "7",  top: "12%",  left: "5%",  rotate: "-18deg" },
    { color: "#3182ce", label: "+2", top: "20%",  right: "6%", rotate: "15deg"  },
    { color: "#38a169", label: "⊘",  bottom:"18%",left: "8%",  rotate: "12deg"  },
    { color: "#d69e2e", label: "↺",  bottom:"22%",right: "5%", rotate: "-14deg" },
    { color: "#7c3aed", label: "★",  top: "35%",  left: "2%",  rotate: "-6deg"  },
    { color: "#e53e3e", label: "9",  top: "8%",   right: "12%",rotate: "22deg"  },
  ];

  return (
    <AnimatePresence>
      {!starting && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.35 }}
          className="table-bg"
          style={{
            minHeight: "100svh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 32,
            padding: "24px 20px",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* Decorative floating cards */}
          {decorCards.map((c, i) => (
            <FloatingCard
              key={i}
              color={c.color}
              label={c.label}
              style={{
                top: c.top, left: (c as { left?: string }).left,
                right: (c as { right?: string }).right,
                bottom: (c as { bottom?: string }).bottom,
                transform: `rotate(${c.rotate})`,
                opacity: 0.55,
              }}
            />
          ))}

          {/* Content layer */}
          <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", gap: 28, width: "100%", maxWidth: 380 }}>

            {/* Logo */}
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 18 }}
              style={{ textAlign: "center" }}
            >
              <motion.h1
                animate={{ y: [0, -6, 0] }}
                transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }}
                style={{
                  fontFamily: "'Nunito', sans-serif",
                  fontWeight: 900,
                  fontSize: "clamp(72px, 18vw, 110px)",
                  letterSpacing: 10,
                  background: "linear-gradient(135deg, #e53e3e 0%, #d69e2e 35%, #38a169 65%, #3182ce 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.6))",
                  lineHeight: 1,
                }}
              >
                UNO
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                style={{
                  color: "rgba(255,255,255,0.5)",
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: 4,
                  textTransform: "uppercase",
                  marginTop: 4,
                }}
              >
                The Classic Card Game
              </motion.p>
            </motion.div>

            {/* Difficulty */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28 }}
              style={{ width: "100%" }}
            >
              <p style={{
                textAlign: "center",
                color: "rgba(255,255,255,0.5)",
                fontSize: 11, fontWeight: 700,
                letterSpacing: 4, textTransform: "uppercase",
                marginBottom: 10,
              }}>Select Difficulty</p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {DIFFICULTIES.map(({ key, label, desc, color, glow }) => {
                  const active = selected === key;
                  return (
                    <motion.button
                      key={key}
                      whileHover={{ scale: 1.05, y: -3 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setSelected(key)}
                      style={{
                        display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center",
                        gap: 4, padding: "14px 8px",
                        borderRadius: 16,
                        border: `2px solid ${active ? color : "rgba(255,255,255,0.12)"}`,
                        background: active ? `${color}28` : "rgba(255,255,255,0.05)",
                        cursor: "pointer",
                        boxShadow: active ? `0 0 20px ${glow}, inset 0 0 10px ${color}20` : "none",
                        transition: "all 0.2s",
                      }}
                      aria-pressed={active}
                    >
                      <div style={{
                        width: 28, height: 28, borderRadius: "50%",
                        background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 60%, black))`,
                        boxShadow: active ? `0 0 10px ${glow}` : "none",
                        marginBottom: 2,
                      }} />
                      <span style={{ fontWeight: 900, fontSize: 13, color: active ? color : "rgba(255,255,255,0.75)" }}>
                        {label}
                      </span>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>
                        {desc}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>

            {/* Play button */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              whileHover={{ scale: 1.07, y: -4 }}
              whileTap={{ scale: 0.96 }}
              onClick={startGame}
              style={{
                width: "100%",
                padding: "18px 0",
                borderRadius: 20,
                background: "linear-gradient(135deg, #e53e3e 0%, #9b2c2c 100%)",
                border: "2px solid rgba(255,255,255,0.2)",
                boxShadow: "0 8px 32px rgba(229,62,62,0.5), inset 0 1px 0 rgba(255,255,255,0.15)",
                cursor: "pointer",
                fontFamily: "'Nunito', sans-serif",
                fontWeight: 900, fontSize: 22,
                color: "white",
                letterSpacing: 2,
                textShadow: "0 2px 8px rgba(0,0,0,0.4)",
              }}
              aria-label="Start game"
            >
              🃏 Play Now!
            </motion.button>

            {/* Rules hint */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.65 }}
              style={{
                textAlign: "center",
                color: "rgba(255,255,255,0.3)",
                fontSize: 11,
                lineHeight: 1.6,
                maxWidth: 280,
              }}
            >
              Match color or number · Wild cards anytime · First to empty hand wins!
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
