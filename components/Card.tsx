"use client";

import { useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card as UnoCard } from "@/types/uno";

interface Props {
  card: UnoCard;
  onClick?: () => void;
  isPlayable?: boolean;
  isBack?: boolean;
  small?: boolean;
}

// ── Color palettes ────────────────────────────────────────────────
const BG: Record<string, string> = {
  red:    "linear-gradient(145deg, #e53e3e 0%, #c53030 60%, #9b2c2c 100%)",
  blue:   "linear-gradient(145deg, #3182ce 0%, #2b6cb0 60%, #2c5282 100%)",
  green:  "linear-gradient(145deg, #38a169 0%, #2f855a 60%, #276749 100%)",
  yellow: "linear-gradient(145deg, #d69e2e 0%, #b7791f 60%, #975a16 100%)",
};

const GLOW_CLASS: Record<string, string> = {
  red:    "card-glow-red",
  blue:   "card-glow-blue",
  green:  "card-glow-green",
  yellow: "card-glow-yellow",
};

const LABEL: Record<string, string> = {
  skip:    "⊘",
  reverse: "↺",
  draw2:   "+2",
  wild:    "★",
  wild4:   "+4",
};

// ── Wild quadrant ─────────────────────────────────────────────────
function WildQuadrant() {
  return (
    <div className="wild-quadrant absolute inset-0 pointer-events-none">
      <div style={{ background: "#e53e3e" }} />
      <div style={{ background: "#3182ce" }} />
      <div style={{ background: "#38a169" }} />
      <div style={{ background: "#d69e2e" }} />
    </div>
  );
}

// ── Card back ─────────────────────────────────────────────────────
function CardBack({ small }: { small?: boolean }) {
  const w = small ? 40  : 80;
  const h = small ? 56  : 112;
  const r = small ? 8   : 14;
  const border = small ? 2 : 3;

  return (
    <div
      style={{
        width: w, height: h,
        borderRadius: r,
        border: `${border}px solid rgba(255,255,255,0.25)`,
        background: "linear-gradient(145deg, #1a103c 0%, #2d1b69 60%, #1a103c 100%)",
        boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* diagonal pattern */}
      <div className="card-back-pattern absolute inset-0" />
      {/* inner frame */}
      <div style={{
        position: "absolute",
        inset: small ? 4 : 7,
        borderRadius: small ? 4 : 8,
        border: `${small ? 1.5 : 2}px solid rgba(255,255,255,0.18)`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{
          fontFamily: "'Nunito', sans-serif",
          fontWeight: 900,
          fontSize: small ? 10 : 18,
          color: "rgba(255,255,255,0.85)",
          letterSpacing: 1,
          textShadow: "0 0 8px rgba(139,92,246,0.6)",
        }}>UNO</span>
      </div>
      {/* corner accents */}
      {!small && (
        <>
          <div style={{ position:"absolute", top:4, left:4, width:8, height:8,
            borderTop:"1.5px solid rgba(139,92,246,0.6)", borderLeft:"1.5px solid rgba(139,92,246,0.6)" }} />
          <div style={{ position:"absolute", top:4, right:4, width:8, height:8,
            borderTop:"1.5px solid rgba(139,92,246,0.6)", borderRight:"1.5px solid rgba(139,92,246,0.6)" }} />
          <div style={{ position:"absolute", bottom:4, left:4, width:8, height:8,
            borderBottom:"1.5px solid rgba(139,92,246,0.6)", borderLeft:"1.5px solid rgba(139,92,246,0.6)" }} />
          <div style={{ position:"absolute", bottom:4, right:4, width:8, height:8,
            borderBottom:"1.5px solid rgba(139,92,246,0.6)", borderRight:"1.5px solid rgba(139,92,246,0.6)" }} />
        </>
      )}
    </div>
  );
}

// ── Main Card ─────────────────────────────────────────────────────
export default function Card({ card, onClick, isPlayable = true, isBack = false, small = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef     = useRef<HTMLDivElement>(null);
  const [hovering, setHovering] = useState(false);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = innerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top)  / rect.height;
    const rx = (0.5 - y) * 22;
    const ry = (x - 0.5) * 22;
    el.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg) translateZ(${onClick && isPlayable ? 18 : 6}px)`;
    el.style.setProperty("--gx", `${x * 100}%`);
    el.style.setProperty("--gy", `${y * 100}%`);
    el.style.setProperty("--glare-opacity", "1");
    el.style.transition = "transform 80ms linear";
  }, [onClick, isPlayable]);

  const handleMouseLeave = useCallback(() => {
    const el = innerRef.current;
    if (!el) return;
    el.style.transform = "rotateX(0deg) rotateY(0deg) translateZ(0px)";
    el.style.setProperty("--glare-opacity", "0");
    el.style.transition = "transform 600ms ease, box-shadow 300ms ease";
    setHovering(false);
  }, []);

  const handleMouseEnter = useCallback(() => setHovering(true), []);

  if (isBack) return <CardBack small={small} />;

  const isWild   = card.value === "wild" || card.value === "wild4";
  const bg       = card.color ? BG[card.color] : "linear-gradient(145deg, #1a103c 0%, #4c1d95 60%, #1a103c 100%)";
  const glowCls  = card.color ? (GLOW_CLASS[card.color] ?? "") : "card-glow-wild";
  const label    = typeof card.value === "number" ? String(card.value) : (LABEL[card.value] ?? String(card.value));

  const w = small ? 40 : 80;
  const h = small ? 56 : 112;
  const r = small ? 8  : 14;
  const textSz  = small ? 13 : 26;
  const cornerSz = small ? 8  : 11;

  const playableClass = !small && onClick ? (isPlayable ? "playable" : "unplayable") : "";

  return (
    <motion.div
      layout
      initial={{ scale: 0.6, opacity: 0, y: -30 }}
      animate={{ scale: 1,   opacity: 1, y: 0 }}
      exit={{    scale: 0.3, opacity: 0, y: -50 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      className="card-3d-container flex-shrink-0"
      style={{ width: w, height: h }}
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseEnter={handleMouseEnter}
    >
      <div
        ref={innerRef}
        onClick={onClick && isPlayable ? onClick : undefined}
        className={`card-3d-inner ${glowCls} ${playableClass}`}
        style={{
          width: w, height: h,
          borderRadius: r,
          background: bg,
          border: "2.5px solid rgba(255,255,255,0.2)",
          cursor: onClick && isPlayable ? "pointer" : "default",
          position: "relative",
          overflow: "hidden",
        }}
        role={onClick ? "button" : undefined}
        aria-label={`${card.color ?? "wild"} ${label} card`}
      >
        {/* Glare overlay */}
        <div className="card-glare" />

        {/* Scan line */}
        {!small && <div className="card-scanline" />}

        {/* Cyber sweep lines */}
        {!small && hovering && (
          <>
            <div className="card-cyberline card-cyberline-1" />
            <div className="card-cyberline card-cyberline-2" />
            <div className="card-cyberline card-cyberline-3" />
          </>
        )}

        {/* Corner L-brackets */}
        {!small && (
          <>
            <div className="card-corner card-corner-tl" />
            <div className="card-corner card-corner-tr" />
            <div className="card-corner card-corner-bl" />
            <div className="card-corner card-corner-br" />
          </>
        )}

        {/* Inner oval */}
        <div style={{
          position: "absolute",
          inset: small ? 5 : 10,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.12)",
          border: `${small ? 1 : 1.5}px solid rgba(255,255,255,0.2)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}>
          {isWild && <WildQuadrant />}
          <span style={{
            fontFamily: "'Nunito', sans-serif",
            fontWeight: 900,
            fontSize: textSz,
            color: "white",
            textShadow: "0 2px 8px rgba(0,0,0,0.6), 0 0 16px rgba(255,255,255,0.3)",
            position: "relative",
            zIndex: 2,
            lineHeight: 1,
          }}>
            {label}
          </span>
        </div>

        {/* Corner value labels */}
        {!small && (
          <>
            <span style={{
              position: "absolute", top: 4, left: 7,
              fontFamily: "'Nunito', sans-serif", fontWeight: 900,
              fontSize: cornerSz, color: "rgba(255,255,255,0.9)",
              lineHeight: 1, zIndex: 5,
              textShadow: "0 1px 3px rgba(0,0,0,0.5)",
            }}>{label}</span>
            <span style={{
              position: "absolute", bottom: 4, right: 7,
              fontFamily: "'Nunito', sans-serif", fontWeight: 900,
              fontSize: cornerSz, color: "rgba(255,255,255,0.9)",
              lineHeight: 1, zIndex: 5, transform: "rotate(180deg)",
              textShadow: "0 1px 3px rgba(0,0,0,0.5)",
            }}>{label}</span>
          </>
        )}

        {/* Color badge for wild (shows chosen color) */}
        {isWild && card.color && !small && (
          <div style={{
            position: "absolute", bottom: 18, left: "50%",
            transform: "translateX(-50%)",
            width: 10, height: 10, borderRadius: "50%",
            background: BG[card.color] || card.color,
            border: "1.5px solid rgba(255,255,255,0.6)",
            zIndex: 5,
          }} />
        )}
      </div>
    </motion.div>
  );
}
