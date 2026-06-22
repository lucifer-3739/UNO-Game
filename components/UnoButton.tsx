"use client";

import { motion, AnimatePresence } from "framer-motion";

interface Props {
  visible: boolean;
  onCall: () => void;
}

export default function UnoButton({ visible, onCall }: Props) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          exit={{ scale: 0, rotate: 20 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
          onClick={onCall}
          className="uno-glow fixed bottom-24 right-6 z-40 w-20 h-20 rounded-full font-black text-2xl text-white shadow-2xl border-4 border-yellow-300"
          style={{ background: "linear-gradient(135deg, #dc2626, #7f1d1d)" }}
          aria-label="Call UNO"
        >
          UNO!
        </motion.button>
      )}
    </AnimatePresence>
  );
}
