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
        <p className="text-white/70 text-sm font-bold uppercase tracking-wider">{label}</p>
      )}
      <div className="flex flex-wrap gap-1.5 justify-center max-w-2xl px-2">
        <AnimatePresence mode="popLayout">
          {cards.map((card) => (
            <motion.div
              key={card.id}
              initial={{ scale: 0.5, opacity: 0, y: -40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.3, opacity: 0, y: -60 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              layout
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
        <p className="text-white/50 text-xs font-medium">{cards.length} card{cards.length !== 1 ? "s" : ""}</p>
      )}
    </div>
  );
}
