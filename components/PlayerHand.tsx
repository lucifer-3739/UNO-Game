"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Card as UnoCard } from "@/types/uno";
import Card from "./Card";

interface Props {
  cards: UnoCard[];
  playableIds?: Set<string>;
  onPlay?: (cardId: string) => void;
  isOpponent?: boolean;
  label?: string;
}

export default function PlayerHand({ cards, playableIds, onPlay, isOpponent = false, label }: Props) {
  return (
    <div className="flex flex-col items-center gap-2">
      {label && (
        <p className="text-white/60 text-xs font-bold uppercase tracking-widest">{label}</p>
      )}

      {/* Scrollable card row */}
      <div
        className="flex gap-1 justify-start px-4 overflow-x-auto no-scrollbar"
        style={{ maxWidth: "100vw", paddingBottom: 4 }}
      >
        <AnimatePresence mode="popLayout">
          {cards.map((card, i) => (
            <motion.div
              key={card.id}
              layout
              initial={{ scale: 0.5, opacity: 0, y: isOpponent ? -30 : 30 }}
              animate={{
                scale: 1, opacity: 1, y: 0,
                // slight fan for human hand (subtle rotation)
                rotate: !isOpponent && cards.length > 4
                  ? ((i - (cards.length - 1) / 2) / cards.length) * 6
                  : 0,
              }}
              exit={{ scale: 0.3, opacity: 0, y: isOpponent ? -40 : 40 }}
              transition={{ type: "spring", stiffness: 300, damping: 22, delay: i * 0.02 }}
              style={{ flexShrink: 0 }}
            >
              {isOpponent ? (
                <Card card={card} isBack small />
              ) : (
                <Card
                  card={card}
                  isPlayable={playableIds ? playableIds.has(card.id) : true}
                  onClick={onPlay && playableIds?.has(card.id) ? () => onPlay(card.id) : undefined}
                />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {!isOpponent && (
        <p className="text-white/40 text-xs font-bold">
          {cards.length} card{cards.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
