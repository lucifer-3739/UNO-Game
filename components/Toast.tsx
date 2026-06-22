"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Toast } from "@/types/uno";
import { useGameStore } from "@/store/gameStore";

const TYPE_STYLES: Record<Toast["type"], string> = {
  info:    "bg-blue-600/90 border-blue-400",
  success: "bg-green-600/90 border-green-400",
  warning: "bg-yellow-600/90 border-yellow-400",
  error:   "bg-red-600/90 border-red-400",
};

const TYPE_ICONS: Record<Toast["type"], string> = {
  info:    "ℹ️",
  success: "✅",
  warning: "⚠️",
  error:   "❌",
};

function ToastItem({ toast }: { toast: Toast }) {
  const dismissToast = useGameStore((s) => s.dismissToast);

  // Auto-dismiss after 3.5 s
  useEffect(() => {
    const t = setTimeout(() => dismissToast(toast.id), 3500);
    return () => clearTimeout(t);
  }, [toast.id, dismissToast]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.9 }}
      animate={{ opacity: 1, x: 0,  scale: 1 }}
      exit={{   opacity: 0, x: 80, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 350, damping: 28 }}
      onClick={() => dismissToast(toast.id)}
      className={`
        flex items-start gap-2 px-4 py-3 rounded-xl border backdrop-blur-sm
        shadow-xl cursor-pointer max-w-xs text-white text-sm font-bold
        ${TYPE_STYLES[toast.type]}
      `}
      role="alert"
    >
      <span className="text-base leading-none mt-0.5 flex-shrink-0">
        {TYPE_ICONS[toast.type]}
      </span>
      <span className="leading-snug">{toast.message}</span>
    </motion.div>
  );
}

export default function ToastContainer() {
  const toasts = useGameStore((s) => s.toasts);

  return (
    <div className="fixed top-14 right-3 z-50 flex flex-col gap-2 pointer-events-none">
      <div className="pointer-events-auto flex flex-col gap-2">
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
