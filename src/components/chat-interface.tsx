"use client";

import type React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  Send,
  Moon,
  Sun,
  Plus,
  X,
  Search,
  Loader2,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { useTheme } from "next-themes";
import confetti from "canvas-confetti";
import ChatMessage from "@/components/chat-message";
import TypingIndicator from "@/components/typing-indicator";

interface ChatInterfaceProps {
  onClose: () => void;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  status?: "sending" | "sent" | "failed";
  originalInput?: string; // Store original input for retry
}

interface SessionState {
  session_id: string;
  state: string;
  completed: boolean;
}

interface GiphyGif {
  id: string;
  title: string;
  url: string;
  preview: string;
}

// Fun reaction memes
const MEMES = [
  {
    id: "therapy",
    label: "i'll work that out in therapy",
    url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExaTBpdzNjZGV0ZGFsZHFpbHIyZXp1ZTB3bGhhMHpoMmpmb2RsZWJtdyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/4lqN6OCl0L3Uicxrhb/giphy.gif",
  },
  {
    id: "nothing",
    label: "you didn't see anything",
    url: "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYmhqZmdkaTkxd3c0a3BvMXZ4M2FvcTZueGxhbWt3bjU0amdqZzlndSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/XItRQJP0wai7m/giphy.gif",
  },
  {
    id: "batman",
    label: "i am batman",
    url: "https://media.giphy.com/media/nZUcWtrNqs9Nu/giphy.gif?cid=790b7611a7nnv72qd4xevr55yokyouikbh6khcxo4d5vslnr&ep=v1_gifs_search&rid=giphy.gif&ct=g",
  },
  {
    id: "typing",
    label: "cat typing",
    url: "https://github.com/MastooraTurkmen/MastooraTurkmen/assets/132576850/4f51607c-7b3b-445a-bd5e-320f11a81eed",
  },
  {
    id: "focused",
    label: "focused programmer",
    url: "https://github.com/MastooraTurkmen/MastooraTurkmen/assets/132576850/ddec8b62-1039-42d3-a361-46dcc1338b07",
  },
];

const STATE_ORDER = [
  "AWAITING_EMAIL",
  "AWAITING_SECRET_PHRASE",
  "AWAITING_NAME",
  "AWAITING_WHATSAPP",
  "AWAITING_ENGINEERING_AREA",
  "AWAITING_SKILL_LEVEL",
  "AWAITING_IMPROVEMENT_GOALS",
  "AWAITING_CAREER_GOALS",
  "AWAITING_GITHUB",
  "AWAITING_LINKEDIN",
  "AWAITING_PORTFOLIO",
  "AWAITING_PROJECTS",
  "AWAITING_TIME_COMMITMENT",
  "AWAITING_LEARNING_STYLE",
  "AWAITING_TECH_FOCUS",
  "AWAITING_SUCCESS_DEFINITION",
  "COMPLETED",
];

// Cool phase names for each state
const PHASE_NAMES: Record<string, string> = {
  AWAITING_EMAIL: "identify",
  AWAITING_SECRET_PHRASE: "secret key",
  AWAITING_NAME: "introductions",
  AWAITING_WHATSAPP: "contact",
  AWAITING_ENGINEERING_AREA: "discovering",
  AWAITING_SKILL_LEVEL: "calibrating",
  AWAITING_IMPROVEMENT_GOALS: "aspirations",
  AWAITING_CAREER_GOALS: "envisioning",
  AWAITING_GITHUB: "connecting",
  AWAITING_LINKEDIN: "networking",
  AWAITING_PORTFOLIO: "showcasing",
  AWAITING_PROJECTS: "exploring",
  AWAITING_TIME_COMMITMENT: "committing",
  AWAITING_LEARNING_STYLE: "understanding",
  AWAITING_TECH_FOCUS: "focusing",
  AWAITING_SUCCESS_DEFINITION: "defining",
  COMPLETED: "complete ✨",
};

// Dynamic input config based on state
const INPUT_CONFIG: Record<
  string,
  { type: string; placeholder: string; pattern?: string; inputMode?: string }
> = {
  AWAITING_EMAIL: {
    type: "email",
    placeholder: "your@email.com",
    inputMode: "email",
  },
  AWAITING_SECRET_PHRASE: {
    type: "text",
    placeholder: "create a memorable phrase...",
  },
  AWAITING_NAME: { type: "text", placeholder: "your name..." },
  AWAITING_WHATSAPP: {
    type: "tel",
    placeholder: "+1234567890",
    inputMode: "tel",
  },
  AWAITING_GITHUB: {
    type: "url",
    placeholder: "github.com/username",
    inputMode: "url",
  },
  AWAITING_LINKEDIN: {
    type: "url",
    placeholder: "linkedin.com/in/username",
    inputMode: "url",
  },
  AWAITING_PORTFOLIO: {
    type: "url",
    placeholder: "yoursite.com",
    inputMode: "url",
  },
  AWAITING_TIME_COMMITMENT: { type: "text", placeholder: "e.g. 10 hours/week" },
  DEFAULT: { type: "text", placeholder: "type here..." },
};

export default function ChatInterface({ onClose }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showMemes, setShowMemes] = useState(false);
  const [giphySearch, setGiphySearch] = useState("");
  const [giphyResults, setGiphyResults] = useState<GiphyGif[]>([]);
  const [isSearchingGiphy, setIsSearchingGiphy] = useState(false);
  const [showGiphySearch, setShowGiphySearch] = useState(false);
  const [hasShownCelebration, setHasShownCelebration] = useState(false);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [savedSession, setSavedSession] = useState<{
    session_id: string;
    state: string;
    messages: Message[];
  } | null>(null);
  const [pendingRetry, setPendingRetry] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const giphySearchRef = useRef<HTMLInputElement>(null);
  const { theme, setTheme } = useTheme();

  // Save session to localStorage whenever it changes
  useEffect(() => {
    if (sessionState && messages.length > 0 && !sessionState.completed) {
      localStorage.setItem(
        "onboarding_session",
        JSON.stringify({
          session_id: sessionState.session_id,
          state: sessionState.state,
          messages,
          timestamp: Date.now(),
        })
      );
    }
  }, [sessionState, messages]);

  // Clear saved session when completed
  useEffect(() => {
    if (sessionState?.completed) {
      localStorage.removeItem("onboarding_session");
    }
  }, [sessionState?.completed]);

  // Celebration effect
  const triggerCelebration = useCallback(() => {
    // Play success sound
    const audio = new Audio("/sounds/success.mp3");
    audio.volume = 0.5;
    audio.play().catch(() => {
      // Ignore audio play errors (autoplay restrictions)
    });

    // Fire confetti from both sides
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const colors = ["#fb923c", "#f97316", "#eab308", "#fbbf24", "#a855f7"];

    const randomInRange = (min: number, max: number) =>
      Math.random() * (max - min) + min;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors,
      });

      if (Date.now() < animationEnd) {
        requestAnimationFrame(frame);
      }
    };

    frame();

    // Big burst in the middle
    setTimeout(() => {
      confetti({
        particleCount: 100,
        spread: 100,
        origin: { x: 0.5, y: 0.5 },
        colors,
        scalar: 1.2,
      });
    }, 500);
  }, []);

  // Trigger celebration when completed
  useEffect(() => {
    if (sessionState?.completed && !hasShownCelebration) {
      setHasShownCelebration(true);
      triggerCelebration();
    }
  }, [sessionState?.completed, hasShownCelebration, triggerCelebration]);

  const getProgress = () => {
    if (!sessionState) return { current: 0, total: STATE_ORDER.length };
    const stateIndex = STATE_ORDER.indexOf(sessionState.state);
    return {
      current: stateIndex >= 0 ? stateIndex + 1 : 1,
      total: STATE_ORDER.length,
    };
  };

  // Retry helper with exponential backoff
  const fetchWithRetry = async (
    url: string,
    options: RequestInit,
    maxRetries = 3
  ): Promise<Response> => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(url, options);
        if (!response.ok && response.status >= 500) {
          throw new Error(`Server error: ${response.status}`);
        }
        return response;
      } catch (error) {
        lastError = error as Error;
        // Only retry on network errors or 5xx
        if (attempt < maxRetries - 1) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }
    throw lastError;
  };

  // Get suggestions - now from API response
  const getSuggestions = () => {
    if (!sessionState || isLoading || showMemes) return [];
    return suggestions;
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    inputRef.current?.focus();
  };

  // Search Giphy
  const searchGiphy = async (query: string) => {
    if (!query.trim()) {
      setGiphyResults([]);
      return;
    }

    setIsSearchingGiphy(true);
    try {
      const response = await fetch(
        `/api/giphy?q=${encodeURIComponent(query)}&limit=12`
      );
      const data = await response.json();
      setGiphyResults(data.data || []);
    } catch (error) {
      console.error("Giphy search failed:", error);
      setGiphyResults([]);
    } finally {
      setIsSearchingGiphy(false);
    }
  };

  // Debounced Giphy search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (showGiphySearch && giphySearch) {
        searchGiphy(giphySearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [giphySearch, showGiphySearch]);

  // Handle Giphy gif selection
  const handleGiphySelect = async (gif: GiphyGif) => {
    if (!sessionState) return;

    const memeContent = `![${gif.title}](${gif.url})`;
    const memeMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: memeContent,
      timestamp: Date.now(),
      status: "sending",
      originalInput: `[user sent a gif: "${gif.title}"]`,
    };

    setMessages((prev) => [...prev, memeMessage]);
    setShowMemes(false);
    setShowGiphySearch(false);
    setGiphySearch("");
    setGiphyResults([]);
    setIsLoading(true);

    try {
      const response = await fetchWithRetry("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionState.session_id,
          message_id: memeMessage.id,
          user_input: memeMessage.originalInput,
        }),
      });

      const data = await response.json();
      setSessionState(data.server_state);
      setSuggestions(data.suggestions || []);

      // Mark message as sent
      setMessages((prev) =>
        prev.map((m) =>
          m.id === memeMessage.id ? { ...m, status: "sent" } : m
        )
      );

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.assistant_message,
          timestamp: Date.now(),
          status: "sent",
        },
      ]);
    } catch (error) {
      console.error("Failed to send gif:", error);
      // Mark message as failed
      setMessages((prev) =>
        prev.map((m) =>
          m.id === memeMessage.id ? { ...m, status: "failed" } : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handle meme selection - user sends the meme and bot responds
  const handleMemeSelect = async (meme: (typeof MEMES)[0]) => {
    if (!sessionState) return;

    const memeContent = `![${meme.label}](${meme.url})`;
    const memeMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: memeContent,
      timestamp: Date.now(),
      status: "sending",
      originalInput: `[user sent a meme: "${meme.label}"]`,
    };

    setMessages((prev) => [...prev, memeMessage]);
    setShowMemes(false);
    setIsLoading(true);

    try {
      const response = await fetchWithRetry("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionState.session_id,
          message_id: memeMessage.id,
          user_input: memeMessage.originalInput,
        }),
      });

      const data = await response.json();
      setSessionState(data.server_state);
      setSuggestions(data.suggestions || []);

      // Mark message as sent
      setMessages((prev) =>
        prev.map((m) =>
          m.id === memeMessage.id ? { ...m, status: "sent" } : m
        )
      );

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.assistant_message,
          timestamp: Date.now(),
          status: "sent",
        },
      ]);
    } catch (error) {
      console.error("Failed to send meme:", error);
      // Mark message as failed
      setMessages((prev) =>
        prev.map((m) =>
          m.id === memeMessage.id ? { ...m, status: "failed" } : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Check for saved session
    const saved = localStorage.getItem("onboarding_session");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Only show resume prompt if session is less than 24 hours old
        const isRecent = Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000;
        if (isRecent && parsed.state !== "COMPLETED") {
          setSavedSession(parsed);
          setShowResumePrompt(true);
          return;
        }
      } catch (e) {
        localStorage.removeItem("onboarding_session");
      }
    }

    // Start fresh session
    startFreshSession();
  }, []);

  const startFreshSession = async () => {
    setShowResumePrompt(false);
    setSavedSession(null);
    localStorage.removeItem("onboarding_session");

    const newSessionId = crypto.randomUUID();
    const initMessageId = crypto.randomUUID();

    try {
      const response = await fetchWithRetry("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: newSessionId,
          message_id: initMessageId,
          user_input: "",
          action: "init",
        }),
      });

      const data = await response.json();
      console.log("Init response:", data);
      setSessionState(data.server_state);
      setSuggestions(data.suggestions || []);
      setMessages([
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.assistant_message,
          timestamp: Date.now(),
          status: "sent",
        },
      ]);
    } catch (error) {
      console.error("Failed to initialize session:", error);
      // Show error state and allow retry
      setSessionState({
        session_id: newSessionId,
        state: "AWAITING_NAME",
        completed: false,
      });
      setMessages([
        {
          id: initMessageId,
          role: "assistant",
          content: "couldn't connect. tap to retry.",
          timestamp: Date.now(),
          status: "failed",
        },
      ]);
    }
  };

  const resumeSession = async () => {
    if (!savedSession) return;

    setShowResumePrompt(false);
    setMessages(savedSession.messages);

    const resumeMessageId = crypto.randomUUID();

    // Resume with the saved session ID
    try {
      const response = await fetchWithRetry("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: savedSession.session_id,
          message_id: resumeMessageId,
          user_input: "",
          action: "resume",
        }),
      });

      const data = await response.json();
      setSessionState(data.server_state);
      setSuggestions(data.suggestions || []);

      // Add a welcome back message
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.assistant_message,
          timestamp: Date.now(),
          status: "sent",
        },
      ]);
    } catch (error) {
      console.error("Failed to resume session:", error);
      // Fall back to fresh session
      startFreshSession();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !sessionState) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input,
      timestamp: Date.now(),
      status: "sending",
      originalInput: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetchWithRetry("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionState.session_id,
          message_id: userMessage.id,
          user_input: userMessage.originalInput,
        }),
      });

      const data = await response.json();
      console.log("Chat response:", data);
      setSessionState(data.server_state);
      setSuggestions(data.suggestions || []);

      // Mark user message as sent
      setMessages((prev) =>
        prev.map((m) =>
          m.id === userMessage.id ? { ...m, status: "sent" } : m
        )
      );

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.assistant_message,
          timestamp: Date.now(),
          status: "sent",
        },
      ]);
    } catch (error) {
      console.error("Failed to send message:", error);
      // Mark message as failed
      setMessages((prev) =>
        prev.map((m) =>
          m.id === userMessage.id ? { ...m, status: "failed" } : m
        )
      );
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  // Retry a failed message - uses same message_id for idempotency
  const handleRetryMessage = async (messageId: string) => {
    if (isLoading || !sessionState) return;

    const failedMessage = messages.find((m) => m.id === messageId);
    if (!failedMessage || failedMessage.status !== "failed") return;

    setPendingRetry(messageId);
    setIsLoading(true);

    // Mark as sending
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, status: "sending" } : m))
    );

    try {
      const response = await fetchWithRetry("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionState.session_id,
          message_id: messageId, // Same ID for idempotency
          user_input: failedMessage.originalInput || failedMessage.content,
          action: failedMessage.role === "assistant" ? "init" : "chat",
        }),
      });

      const data = await response.json();
      setSessionState(data.server_state);
      setSuggestions(data.suggestions || []);

      // Mark as sent
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, status: "sent" } : m))
      );

      // Add assistant response if this was a user message retry
      if (failedMessage.role === "user") {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: data.assistant_message,
            timestamp: Date.now(),
            status: "sent",
          },
        ]);
      } else {
        // Replace the failed assistant message content
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, content: data.assistant_message, status: "sent" }
              : m
          )
        );
      }
    } catch (error) {
      console.error("Retry failed:", error);
      // Mark as failed again
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, status: "failed" } : m))
      );
    } finally {
      setIsLoading(false);
      setPendingRetry(null);
      inputRef.current?.focus();
    }
  };

  const progress = getProgress();

  // Resume prompt
  if (showResumePrompt && savedSession) {
    const savedPhase = PHASE_NAMES[savedSession.state] || "in progress";
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-background p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="liquid-glass rounded-3xl p-6 sm:p-8 max-w-md w-full text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
            className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center mx-auto mb-4"
          >
            <span className="text-3xl">👋</span>
          </motion.div>

          <h2 className="text-xl font-semibold text-foreground mb-2">
            welcome back!
          </h2>
          <p className="text-foreground/60 text-sm mb-6">
            looks like you were in the middle of onboarding.
            <br />
            <span className="text-orange-400">currently at: {savedPhase}</span>
          </p>

          <div className="flex flex-col gap-3">
            <motion.button
              onClick={resumeSession}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3 px-4 rounded-full bg-orange-500 text-white font-medium transition-colors hover:bg-orange-600"
            >
              continue where i left off
            </motion.button>
            <motion.button
              onClick={startFreshSession}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3 px-4 rounded-full bg-foreground/10 text-foreground/70 font-medium transition-colors hover:bg-foreground/15"
            >
              start fresh
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Loading state
  if (!sessionState) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-foreground/40"
        >
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            className="text-center"
          >
            <div className="w-2 h-2 rounded-full bg-orange-400/60 mx-auto mb-3" />
            <span className="text-sm">loading...</span>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-background relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-30%] right-[-20%] w-[70vw] h-[70vw] max-w-[600px] max-h-[600px] rounded-full bg-orange-500/[0.03] blur-[100px]" />
        <div className="absolute bottom-[-20%] left-[-20%] w-[60vw] h-[60vw] max-w-[500px] max-h-[500px] rounded-full bg-amber-500/[0.02] blur-[80px]" />
      </div>

      {/* Top floating controls */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center justify-between"
        >
          {/* Back button */}
          <motion.button
            onClick={onClose}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="liquid-glass-pill w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center text-foreground/60 hover:text-foreground/90 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </motion.button>

          {/* Step indicator - center */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="liquid-glass-pill px-4 py-2 sm:px-5 sm:py-2.5 rounded-2xl flex flex-col items-center gap-1.5"
          >
            <AnimatePresence mode="wait">
              <motion.span
                key={sessionState?.state || "loading"}
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                transition={{ duration: 0.2 }}
                className="text-xs sm:text-sm text-foreground/80 font-medium"
              >
                {PHASE_NAMES[sessionState?.state || "AWAITING_NAME"] ||
                  "loading"}
              </motion.span>
            </AnimatePresence>
            <div className="flex gap-1 sm:gap-1.5">
              {STATE_ORDER.slice(0, -1).map((state, i) => {
                const currentIndex = STATE_ORDER.indexOf(
                  sessionState?.state || "AWAITING_NAME"
                );
                const isCompleted = i < currentIndex;
                const isCurrent = i === currentIndex;
                return (
                  <motion.div
                    key={state}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full transition-all duration-300 ${
                      isCompleted
                        ? "bg-orange-400"
                        : isCurrent
                        ? "bg-orange-400/70 ring-2 ring-orange-400/30"
                        : "bg-foreground/15"
                    }`}
                  />
                );
              })}
            </div>
          </motion.div>

          {/* Theme toggle */}
          <motion.button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="liquid-glass-pill w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center text-foreground/60 hover:text-foreground/90 transition-colors"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </motion.button>
        </motion.div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto pt-20 sm:pt-24 pb-32 sm:pb-40 px-4 sm:px-6 relative z-10">
        <div className="max-w-2xl mx-auto space-y-4 sm:space-y-5">
          <AnimatePresence mode="popLayout">
            {messages.map((message, index) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 15, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{
                  duration: 0.35,
                  ease: [0.16, 1, 0.3, 1],
                  delay: index === messages.length - 1 ? 0.05 : 0,
                }}
              >
                <ChatMessage
                  message={message}
                  onRetry={handleRetryMessage}
                  isRetrying={pendingRetry === message.id}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <TypingIndicator />
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Suggestion carousel - directly above input */}
      <AnimatePresence>
        {getSuggestions().length > 0 && !isLoading && !showMemes && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-[60px] sm:bottom-[70px] left-0 right-0 z-20 px-3 sm:px-4"
          >
            <div className="max-w-2xl mx-auto overflow-hidden">
              {/* Marquee container */}
              <div className="flex w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
                <motion.div
                  className="flex gap-3 py-2"
                  animate={{
                    x: [0, -50 * getSuggestions().length],
                  }}
                  transition={{
                    x: {
                      duration: getSuggestions().length * 3,
                      repeat: Infinity,
                      ease: "linear",
                    },
                  }}
                  whileHover={{ animationPlayState: "paused" }}
                  style={{ animationPlayState: "running" }}
                >
                  {/* Double the items for seamless loop */}
                  {[...getSuggestions(), ...getSuggestions()].map(
                    (suggestion, i) => (
                      <motion.button
                        key={`${suggestion}-${i}`}
                        type="button"
                        onClick={() => handleSuggestionClick(suggestion)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="liquid-glass-pill px-4 py-2 rounded-full text-sm text-foreground/70 hover:text-foreground/90 whitespace-nowrap transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-400/50 flex-shrink-0"
                      >
                        {suggestion}
                      </motion.button>
                    )
                  )}
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Meme picker */}
      <AnimatePresence>
        {showMemes && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-[70px] sm:bottom-[80px] left-0 right-0 z-30 px-3 sm:px-4"
          >
            <div className="max-w-2xl mx-auto">
              <div className="liquid-glass rounded-2xl p-3 sm:p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-foreground/50">
                      {showGiphySearch ? "search giphy" : "reactions"}
                    </span>
                    <motion.button
                      onClick={() => {
                        setShowGiphySearch(!showGiphySearch);
                        if (!showGiphySearch) {
                          setTimeout(
                            () => giphySearchRef.current?.focus(),
                            100
                          );
                        } else {
                          setGiphySearch("");
                          setGiphyResults([]);
                        }
                      }}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className={`p-1.5 rounded-full transition-colors ${
                        showGiphySearch
                          ? "bg-orange-500/20 text-orange-400"
                          : "bg-foreground/10 text-foreground/50 hover:text-foreground/70"
                      }`}
                    >
                      <Search className="w-3 h-3" />
                    </motion.button>
                  </div>
                  <motion.button
                    onClick={() => {
                      setShowMemes(false);
                      setShowGiphySearch(false);
                      setGiphySearch("");
                      setGiphyResults([]);
                    }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="text-foreground/40 hover:text-foreground/70"
                  >
                    <X className="w-4 h-4" />
                  </motion.button>
                </div>

                {/* Giphy search input */}
                <AnimatePresence>
                  {showGiphySearch && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-3"
                    >
                      <div className="relative">
                        <input
                          ref={giphySearchRef}
                          type="text"
                          value={giphySearch}
                          onChange={(e) => setGiphySearch(e.target.value)}
                          placeholder="search for gifs..."
                          className="w-full bg-foreground/5 border border-foreground/10 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 outline-none focus:ring-1 focus:ring-orange-400/50"
                        />
                        {isSearchingGiphy && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/40 animate-spin" />
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Giphy results or default memes */}
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto scrollbar-hide">
                  {showGiphySearch && giphyResults.length > 0 ? (
                    giphyResults.map((gif, i) => (
                      <motion.button
                        key={gif.id}
                        type="button"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.03 }}
                        onClick={() => handleGiphySelect(gif)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="relative aspect-square rounded-xl overflow-hidden bg-foreground/5 hover:ring-2 hover:ring-orange-400/50 transition-all"
                      >
                        <img
                          src={gif.preview || gif.url}
                          alt={gif.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </motion.button>
                    ))
                  ) : showGiphySearch && giphySearch && !isSearchingGiphy ? (
                    <div className="col-span-full text-center py-4 text-foreground/40 text-sm">
                      no gifs found
                    </div>
                  ) : !showGiphySearch ? (
                    MEMES.map((meme, i) => (
                      <motion.button
                        key={meme.id}
                        type="button"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.05 }}
                        onClick={() => handleMemeSelect(meme)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="relative aspect-square rounded-xl overflow-hidden bg-foreground/5 hover:ring-2 hover:ring-orange-400/50 transition-all"
                      >
                        <img
                          src={meme.url}
                          alt={meme.label}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1">
                          <span className="text-[9px] sm:text-[10px] text-white/90 line-clamp-1">
                            {meme.label}
                          </span>
                        </div>
                      </motion.button>
                    ))
                  ) : null}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom input - iMessage style */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-3 sm:p-4 pb-[max(env(safe-area-inset-bottom),12px)] sm:pb-[max(env(safe-area-inset-bottom),16px)]">
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          onSubmit={handleSendMessage}
          className="max-w-2xl mx-auto"
        >
          <div className="liquid-glass rounded-full p-1.5 sm:p-2 flex items-center gap-2">
            {/* Plus/Close button - toggles meme picker */}
            <motion.button
              type="button"
              onClick={() => setShowMemes(!showMemes)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              animate={{ rotate: showMemes ? 45 : 0 }}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ${
                showMemes
                  ? "bg-orange-500/20 text-orange-400"
                  : "bg-foreground/10 text-foreground/50 hover:text-foreground/70"
              }`}
            >
              <Plus className="w-4 h-4" />
            </motion.button>

            {/* Input */}
            <input
              ref={inputRef}
              type={
                (INPUT_CONFIG[sessionState.state] || INPUT_CONFIG.DEFAULT).type
              }
              inputMode={
                (INPUT_CONFIG[sessionState.state] || INPUT_CONFIG.DEFAULT)
                  .inputMode as React.HTMLAttributes<HTMLInputElement>["inputMode"]
              }
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                (INPUT_CONFIG[sessionState.state] || INPUT_CONFIG.DEFAULT)
                  .placeholder
              }
              disabled={isLoading || sessionState.completed}
              className="input-transparent flex-1 bg-transparent border-none outline-none px-2 py-2 sm:py-2.5 text-foreground placeholder:text-foreground/30 text-sm sm:text-base min-w-0"
            />

            {/* Send button */}
            <motion.button
              type="submit"
              disabled={isLoading || !input.trim() || sessionState.completed}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.9 }}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-orange-500 text-white flex items-center justify-center disabled:opacity-30 disabled:scale-100 transition-all flex-shrink-0"
            >
              <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </motion.button>
          </div>
        </motion.form>

        {/* Completion indicator */}
        <AnimatePresence>
          {sessionState.completed && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="text-center mt-3"
            >
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/30"
              >
                <motion.span
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="text-lg"
                >
                  🎉
                </motion.span>
                <span className="text-sm font-medium text-orange-400">
                  onboarding complete!
                </span>
                <motion.span
                  animate={{ rotate: [0, -10, 10, 0] }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="text-lg"
                >
                  🎉
                </motion.span>
              </motion.div>
              <p className="text-xs text-foreground/40 mt-2">
                zuck will review your info and reach out soon
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
