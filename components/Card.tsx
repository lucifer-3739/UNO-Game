"use client";

import { motion } from "framer-motion";
import { Card as UnoCard } from "@/types/uno";

interface Props {
  card: UnoCard;
  onClick?: () => void;
  isPlayable?: boolean;
  isBack?: boolean;
  small?: boolean;
  style?: React.CSSProperties;
}

const BG: Record<string, string> = {
  red: "#dc2626",
  blue: "#2563eb",
  green: "#16a34a",
  yellow: "#ca8a04",
};

const LABEL: Record<string, string> = {
  skip: "⊘",
  reverse: "↺",
  draw2: "+2",
  wild: "🌈",
  wild4: "+4",
};

function WildQuadrant() {
  return (
    <div className="absolute inset-3 rounded-full overflow-hidden">
      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
        <div style={{ background: "#dc2626" }} />
        <div style={{ background: "#2563eb" }} />
        <div style={{ background: "#16a34a" }} />
        <div style={{ background: "#ca8a04" }} />
      </div>
    </div>
  );
}

function CardBack({ small }: { small?: boolean }) {
  const size = small ? "w-10 h-14" : "w-20 h-28";
  return (
    <div
      className={`${size} rounded-xl border-4 border-white card-shadow relative overflow-hidden flex-shrink-0`}
      style={{ background: "#1e1b4b" }}
    >
      <div className="absolute inset-2 rounded-lg border-2 border-white/30 flex items-center justify-center">
        <span className="text-white font-black text-xl" style={{ fontFamily: "Nunito, sans-serif" }}>UNO</span>
      </div>
    </div>
  );
}

export default function Card({ card, onClick, isPlayable = true, isBack = false, small = false, style }: Props) {
  if (isBack) return <CardBack small={small} />;

  const bg = card.color ? BG[card.color] : "#1e1b4b";
  const label =
    typeof card.value === "number"
      ? String(card.value)
      : LABEL[card.value] ?? card.value;
  const isWild = card.value === "wild" || card.value === "wild4";
  const size = small ? "w-10 h-14" : "w-20 h-28";
  const textSize = small ? "text-sm" : "text-2xl";
  const cornerSize = small ? "text-xs" : "text-xs";

  return (
    <motion.button
      onClick={onClick}
      disabled={!onClick}
      layout
      whileHover={onClick && isPlayable ? { y: -16, scale: 1.08, zIndex: 50 } : {}}
      whileTap={onClick && isPlayable ? { scale: 0.95 } : {}}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={`
        ${size} rounded-xl border-4 border-white card-shadow relative overflow-hidden
        flex-shrink-0 cursor-pointer select-none
        ${!isPlayable && onClick ? "opacity-50 cursor-not-allowed" : ""}
        ${isPlayable && onClick ? "ring-0 hover:ring-4 hover:ring-yellow-300" : ""}
      `}
      style={{ background: bg, ...style }}
      aria-label={`${card.color ?? "wild"} ${label} card`}
    >
      {/* Inner oval */}
      <div
        className="absolute inset-2 rounded-lg flex items-center justify-center overflow-hidden"
        style={{ background: "rgba(255,255,255,0.15)" }}
      >
        {isWild ? (
          <WildQuadrant />
        ) : null}
        <span
          className={`${textSize} font-black text-white drop-shadow-lg relative z-10`}
          style={{ fontFamily: "Nunito, sans-serif", textShadow: "0 2px 4px rgba(0,0,0,0.5)" }}
        >
          {label}
        </span>
      </div>

      {/* Corner labels */}
      {!small && (
        <>
          <span className={`absolute top-1 left-1.5 ${cornerSize} font-black text-white leading-none`}>{label}</span>
          <span className={`absolute bottom-1 right-1.5 ${cornerSize} font-black text-white leading-none rotate-180`}>{label}</span>
        </>
      )}
    </motion.button>
  );
}
