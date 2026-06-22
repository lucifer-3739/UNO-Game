"use client";

import { motion, AnimatePresence } from "framer-motion";

interface Props {
  isOpen: boolean;
  /** Name of the player who played wild4 (the AI) */
  wild4PlayerName: string;
  onChallenge: () => void;
  onAccept: () => void;
}

export default function ChallengeModal({ isOpen, wild4PlayerName, onChallenge, onAccept }: Props) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.80)" }}
        >
          <motion.div
            initial={{ scale: 0.7, y: 40 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.7, y: 40 }}
            transition={{ type: "spring", stiffness: 340, damping: 26 }}
            className="bg-white/10 backdrop-blur-md rounded-3xl p-8 flex flex-col items-center gap-6 shadow-2xl border border-white/20 max-w-sm mx-4"
          >
            {/* Icon */}
            <motion.div
              animate={{ rotate: [0, -8, 8, -8, 0] }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="text-7xl"
            >
              🃏
            </motion.div>

            <div className="text-center">
              <h2 className="text-2xl font-black text-white">Wild Draw Four!</h2>
              <p className="text-white/70 text-sm mt-2 leading-relaxed">
                <strong className="text-yellow-300">{wild4PlayerName}</strong> played Wild Draw Four.
                <br />
                You can <strong className="text-green-300">Challenge</strong> if you think they had
                a matching color card — or <strong className="text-blue-300">Accept</strong> and draw 4.
              </p>
            </div>

            {/* Official rule reminder */}
            <div className="bg-white/5 rounded-2xl p-3 text-white/50 text-xs leading-relaxed text-center">
              <strong className="text-white/70">Official Rule:</strong> If the challenge succeeds
              (they had a playable card), <em>they</em> draw 4. If it fails, <em>you</em> draw 6.
            </div>

            {/* Buttons */}
            <div className="flex gap-3 w-full">
              <motion.button
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={onChallenge}
                className="flex-1 py-4 rounded-2xl font-black text-white text-sm shadow-lg border-2 border-red-400"
                style={{ background: "linear-gradient(135deg, #dc2626, #7f1d1d)" }}
                aria-label="Challenge the Wild Draw Four"
              >
                ⚔️ Challenge!
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={onAccept}
                className="flex-1 py-4 rounded-2xl font-black text-white text-sm shadow-lg border-2 border-blue-400"
                style={{ background: "linear-gradient(135deg, #2563eb, #1e3a8a)" }}
                aria-label="Accept and draw 4 cards"
              >
                ✋ Accept (+4)
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
