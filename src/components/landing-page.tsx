"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Flame } from "lucide-react";

interface LandingPageProps {
  onStart: () => void;
}

const floatingItems = [
  { text: "structured learning path", emoji: "📚" },
  { text: "real-world projects", emoji: "🛠️" },
  { text: "code reviews", emoji: "👀" },
  { text: "accountability", emoji: "✅" },
  { text: "career direction", emoji: "🧭" },
  { text: "this isn't for everyone", emoji: "⚡" },
  { text: "free doesn't mean casual", emoji: "💪" },
  { text: "effort beats talent", emoji: "🔥" },
];

export default function LandingPage({ onStart }: LandingPageProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % floatingItems.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth - 0.5) * 20,
        y: (e.clientY / window.innerHeight - 0.5) * 20,
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Animated gradient mesh background */}
      <div className="absolute inset-0 bg-gradient-mesh opacity-60" />

      {/* Animated glow orbs - warm organic colors */}
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full bg-orange-500/10 blur-[100px]"
        animate={{
          x: mousePosition.x * 2,
          y: mousePosition.y * 2,
          scale: [1, 1.1, 1],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        style={{ top: "20%", left: "30%" }}
      />
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full bg-amber-500/10 blur-[80px]"
        animate={{
          x: mousePosition.x * -1.5,
          y: mousePosition.y * -1.5,
          scale: [1, 1.2, 1],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1,
        }}
        style={{ bottom: "20%", right: "20%" }}
      />
      <motion.div
        className="absolute w-[300px] h-[300px] rounded-full bg-yellow-500/8 blur-[60px]"
        animate={{
          x: mousePosition.x,
          y: mousePosition.y,
          scale: [1, 1.15, 1],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
        style={{ top: "50%", right: "40%" }}
      />

      {/* Floating carousel items - glass morphism style */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Top left floating item */}
        <motion.div
          className="absolute top-20 left-8 md:left-16"
          animate={{
            y: [0, -10, 0],
            x: mousePosition.x * 0.3,
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, scale: 0.8, filter: "blur(10px)" }}
              animate={{ opacity: 0.8, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.8, filter: "blur(10px)" }}
              transition={{ duration: 0.5 }}
              className="glass px-4 py-2.5 rounded-2xl text-sm text-foreground/80 shadow-lg"
            >
              <span className="mr-2">{floatingItems[currentIndex].emoji}</span>
              {floatingItems[currentIndex].text}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Top right floating item */}
        <motion.div
          className="absolute top-32 right-8 md:right-16"
          animate={{
            y: [0, 10, 0],
            x: mousePosition.x * -0.2,
          }}
          transition={{
            duration: 5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={(currentIndex + 2) % floatingItems.length}
              initial={{ opacity: 0, scale: 0.8, filter: "blur(10px)" }}
              animate={{ opacity: 0.7, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.8, filter: "blur(10px)" }}
              transition={{ duration: 0.5 }}
              className="glass px-4 py-2.5 rounded-2xl text-sm text-foreground/70 shadow-lg"
            >
              <span className="mr-2">
                {floatingItems[(currentIndex + 2) % floatingItems.length].emoji}
              </span>
              {floatingItems[(currentIndex + 2) % floatingItems.length].text}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Bottom left floating item */}
        <motion.div
          className="absolute bottom-32 left-8 md:left-20"
          animate={{
            y: [0, -8, 0],
            x: mousePosition.x * 0.25,
          }}
          transition={{
            duration: 4.5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.5,
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={(currentIndex + 4) % floatingItems.length}
              initial={{ opacity: 0, scale: 0.8, filter: "blur(10px)" }}
              animate={{ opacity: 0.6, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.8, filter: "blur(10px)" }}
              transition={{ duration: 0.5 }}
              className="glass px-4 py-2.5 rounded-2xl text-sm text-foreground/60 shadow-lg"
            >
              <span className="mr-2">
                {floatingItems[(currentIndex + 4) % floatingItems.length].emoji}
              </span>
              {floatingItems[(currentIndex + 4) % floatingItems.length].text}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Bottom right floating item */}
        <motion.div
          className="absolute bottom-20 right-8 md:right-24"
          animate={{
            y: [0, 12, 0],
            x: mousePosition.x * -0.15,
          }}
          transition={{
            duration: 5.5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1.5,
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={(currentIndex + 6) % floatingItems.length}
              initial={{ opacity: 0, scale: 0.8, filter: "blur(10px)" }}
              animate={{ opacity: 0.65, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.8, filter: "blur(10px)" }}
              transition={{ duration: 0.5 }}
              className="glass px-4 py-2.5 rounded-2xl text-sm text-foreground/65 shadow-lg"
            >
              <span className="mr-2">
                {floatingItems[(currentIndex + 6) % floatingItems.length].emoji}
              </span>
              {floatingItems[(currentIndex + 6) % floatingItems.length].text}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Centered Hero */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="text-center space-y-8 z-10"
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="inline-flex items-center gap-2 glass px-4 py-2 rounded-full text-sm text-muted-foreground"
        >
          <Flame className="w-4 h-4 text-orange-400" />
          <span className="text-base">by okponglo zuck</span>
        </motion.div>

        <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold leading-tight">
          <span className="text-gradient">level up your engineering.</span>
        </h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-lg md:text-xl text-muted-foreground max-w-lg mx-auto"
        >
          free mentorship. real structure. no hand-holding.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="pt-4"
        >
          <Button
            onClick={onStart}
            size="lg"
            className="relative px-12 py-7 text-base font-semibold rounded-2xl bg-foreground text-background hover:bg-foreground/90 transition-all duration-300 shadow-2xl hover:shadow-orange-500/20 hover:scale-105 group overflow-hidden"
          >
            <span className="relative z-10">onboard</span>
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-orange-500/20 via-amber-500/20 to-yellow-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              animate={{
                backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
              }}
              transition={{ duration: 3, repeat: Infinity }}
            />
          </Button>
        </motion.div>
      </motion.div>

      {/* Bottom decoration */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-muted-foreground/40"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </motion.div>
      </motion.div>
    </div>
  );
}
