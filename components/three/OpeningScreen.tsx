"use client";

import { useEffect, useState, Suspense, lazy } from "react";
import { motion, AnimatePresence } from "framer-motion";

const Orb = lazy(() => import("./Orb").then((m) => ({ default: m.Orb })));

/** A pure-CSS monochrome orb fallback (reduced-motion / no WebGL). */
function StaticOrb() {
  return (
    <div className="relative h-48 w-48">
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#2a2a2a] to-[#0a0a0a] shadow-[0_0_80px_rgba(255,255,255,0.08)]" />
      <div className="absolute inset-2 rounded-full border border-white/10" />
      <div className="absolute inset-8 rounded-full border border-white/5" />
      <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80" />
    </div>
  );
}

export function OpeningScreen({
  onDone,
  motionOn,
}: {
  onDone: () => void;
  motionOn: boolean;
}) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    // Keep the opening brief — the spec wants <3s to chat.
    const t = setTimeout(() => setLeaving(true), motionOn ? 2200 : 900);
    return () => clearTimeout(t);
  }, [motionOn]);

  return (
    <AnimatePresence onExitComplete={onDone}>
      {!leaving && (
        <motion.div
          key="opening"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-primary"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        >
          <div className="h-64 w-64 sm:h-80 sm:w-80">
            {motionOn ? (
              <Suspense fallback={<div className="grid h-full place-items-center"><StaticOrb /></div>}>
                <Orb />
              </Suspense>
            ) : (
              <div className="grid h-full place-items-center">
                <StaticOrb />
              </div>
            )}
          </div>
          <motion.div
            className="mt-2 text-center"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <h1 className="text-2xl font-semibold tracking-tight text-text-primary">NeiroAI</h1>
            <p className="mt-1 text-sm text-text-secondary">Premium AI Workspace</p>
          </motion.div>
          <motion.div
            className="mt-6 flex gap-1.5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-text-secondary animate-pulse-dot"
                style={{ animationDelay: `${i * 0.18}s` }}
              />
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
