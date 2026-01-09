"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import LandingPage from "@/components/landing-page";
import ChatInterface from "@/components/chat-interface";

export default function Home() {
  const [showChat, setShowChat] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleStart = () => {
    setIsTransitioning(true);
    // Delay the actual switch to allow exit animation
    setTimeout(() => {
      setShowChat(true);
      setIsTransitioning(false);
    }, 600);
  };

  const handleClose = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setShowChat(false);
      setIsTransitioning(false);
    }, 400);
  };

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      <AnimatePresence mode="wait">
        {!showChat ? (
          <motion.div
            key="landing"
            initial={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            animate={{
              opacity: isTransitioning ? 0.3 : 1,
              scale: isTransitioning ? 0.92 : 1,
              filter: isTransitioning ? "blur(12px)" : "blur(0px)",
            }}
            exit={{
              opacity: 0,
              scale: 0.88,
              filter: "blur(20px)",
              y: -30,
            }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0"
          >
            <LandingPage onStart={handleStart} />
          </motion.div>
        ) : (
          <motion.div
            key="chat"
            initial={{ opacity: 0, scale: 1.05, y: 40, filter: "blur(10px)" }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
            exit={{
              opacity: 0,
              scale: 0.95,
              y: 20,
              filter: "blur(8px)",
            }}
            transition={{
              duration: 0.8,
              ease: [0.16, 1, 0.3, 1],
              opacity: { duration: 0.5 },
            }}
            className="fixed inset-0"
          >
            <ChatInterface onClose={handleClose} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transition overlay with particles */}
      <AnimatePresence>
        {isTransitioning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 pointer-events-none"
          >
            {/* Radial burst effect */}
            <motion.div
              initial={{ scale: 0, opacity: 0.8 }}
              animate={{ scale: 3, opacity: 0 }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] rounded-full bg-gradient-to-r from-orange-500/30 via-amber-500/20 to-yellow-500/30"
            />

            {/* Floating particles */}
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                initial={{
                  opacity: 0,
                  scale: 0,
                  x: "50vw",
                  y: "50vh",
                }}
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0, 1, 0.5],
                  x: `${50 + (Math.random() - 0.5) * 80}vw`,
                  y: `${50 + (Math.random() - 0.5) * 80}vh`,
                }}
                transition={{
                  duration: 0.8,
                  delay: i * 0.05,
                  ease: "easeOut",
                }}
                className="absolute w-2 h-2 rounded-full bg-orange-400/60"
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
