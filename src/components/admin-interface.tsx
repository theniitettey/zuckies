"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Send,
  CheckCircle,
  Clock,
  XCircle,
  MessageCircle,
  Users,
  Star,
  LogOut,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface Applicant {
  email: string;
  applicant_data: {
    name: string;
    email: string;
    whatsapp?: string;
    engineering_area: string;
    skill_level: string;
    improvement_goals?: string;
    career_goals: string;
    github?: string;
    linkedin?: string;
    portfolio?: string;
    projects?: string;
    time_commitment?: string;
    learning_style?: string;
    tech_focus?: string;
    success_definition?: string;
    application_status: "pending" | "accepted" | "rejected" | "waitlisted";
    submitted_at: string;
    review_notes?: string;
    reviewed_at?: string;
    reviewed_by?: string;
  };
}

interface FeedbackItem {
  _id: string;
  session_id: string;
  email?: string;
  name?: string;
  rating: number;
  feedback?: string;
  suggestions?: string;
  category?: "onboarding" | "mentoring" | "ui" | "general";
  onboarding_state?: string;
  created_at: string;
}

interface AdminInterfaceProps {
  onLogout: () => void;
  adminName?: string;
}

const easing: [number, number, number, number] = [0.16, 1, 0.3, 1];

export default function AdminInterface({
  onLogout,
  adminName = "admin",
}: AdminInterfaceProps) {
  // View state
  const [activeTab, setActiveTab] = useState<"applicants" | "feedback">(
    "applicants"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Data state
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Selection state
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(
    null
  );
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(
    null
  );

  // Notes state
  const [reviewNotes, setReviewNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // Assistant state
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<
    { role: "admin" | "assistant"; content: string }[]
  >([
    {
      role: "assistant",
      content:
        "hey. need help reviewing applicants or have questions? i'm here.",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch data on mount
  useEffect(() => {
    fetchApplicants();
    fetchFeedback();
  }, []);

  // Scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Load notes when applicant selected
  useEffect(() => {
    setReviewNotes(selectedApplicant?.applicant_data?.review_notes || "");
  }, [selectedApplicant]);

  // Filter logic
  const filteredApplicants = applicants.filter((app) => {
    const matchesStatus =
      statusFilter === "all" ||
      app.applicant_data?.application_status === statusFilter;
    const matchesSearch =
      !searchQuery ||
      app.applicant_data?.name
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      app.applicant_data?.email
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const filteredFeedback = feedbackList.filter((fb) => {
    return (
      !searchQuery ||
      fb.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fb.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fb.feedback?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Stats
  const stats = {
    total: applicants.length,
    pending: applicants.filter(
      (a) => a.applicant_data?.application_status === "pending"
    ).length,
    accepted: applicants.filter(
      (a) => a.applicant_data?.application_status === "accepted"
    ).length,
    rejected: applicants.filter(
      (a) => a.applicant_data?.application_status === "rejected"
    ).length,
    waitlisted: applicants.filter(
      (a) => a.applicant_data?.application_status === "waitlisted"
    ).length,
  };

  const avgRating =
    feedbackList.length > 0
      ? (
          feedbackList.reduce((acc, fb) => acc + fb.rating, 0) /
          feedbackList.length
        ).toFixed(1)
      : "—";

  async function fetchApplicants() {
    try {
      setLoading(true);
      const token = localStorage.getItem("admin_token");
      if (!token) {
        toast.error("session expired. please login again.");
        onLogout();
        return;
      }

      const response = await fetch("/api/admin/review", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error("unauthorized. please login again.");
          onLogout();
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setApplicants(data.applications || []);
    } catch (error) {
      console.error("Error fetching applicants:", error);
      toast.error("failed to load applicants");
    } finally {
      setLoading(false);
    }
  }

  async function fetchFeedback() {
    try {
      const token = localStorage.getItem("admin_token");
      if (!token) return;

      const response = await fetch("/api/admin/feedback", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      setFeedbackList(data.feedback || []);
    } catch (error) {
      console.error("Error fetching feedback:", error);
    }
  }

  async function updateApplicationStatus(
    email: string,
    status: "accepted" | "rejected" | "waitlisted"
  ) {
    try {
      const token = localStorage.getItem("admin_token");
      const response = await fetch("/api/admin/review", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email, application_status: status }),
      });

      if (!response.ok) throw new Error("Update failed");

      toast.success(`applicant ${status}`);
      fetchApplicants();
      setSelectedApplicant(null);
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("failed to update status");
    }
  }

  async function saveReviewNotes() {
    if (!selectedApplicant) return;

    try {
      setSavingNotes(true);
      const token = localStorage.getItem("admin_token");
      const response = await fetch("/api/admin/review", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: selectedApplicant.email,
          review_notes: reviewNotes,
        }),
      });

      if (!response.ok) throw new Error("Save failed");

      toast.success("notes saved");
      fetchApplicants();
    } catch (error) {
      console.error("Error saving notes:", error);
      toast.error("failed to save notes");
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleSendMessage() {
    if (!chatInput.trim()) return;

    const userMessage = chatInput;
    setChatMessages((prev) => [
      ...prev,
      { role: "admin", content: userMessage },
    ]);
    setChatInput("");
    setChatLoading(true);

    try {
      const response = await fetch("/api/admin/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          session_id: chatSessionId,
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();
      if (data.session_id && !chatSessionId) setChatSessionId(data.session_id);

      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.message },
      ]);
    } catch (error) {
      console.error("Chat error:", error);
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "something went wrong. try again." },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "accepted":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "rejected":
        return "bg-red-500/10 text-red-400 border-red-500/20";
      case "waitlisted":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      default:
        return "bg-orange-500/10 text-orange-400 border-orange-500/20";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "accepted":
        return <CheckCircle className="w-3.5 h-3.5" />;
      case "rejected":
        return <XCircle className="w-3.5 h-3.5" />;
      case "waitlisted":
        return <Clock className="w-3.5 h-3.5" />;
      default:
        return <Clock className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* iOS 26 Ambient background with animated mesh */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-mesh opacity-50" />
        <motion.div
          className="absolute w-[700px] h-[700px] rounded-full bg-orange-500/[0.06] blur-[150px]"
          animate={{
            x: [0, 50, 0],
            y: [0, 30, 0],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          style={{ top: "-15%", right: "-10%" }}
        />
        <motion.div
          className="absolute w-[600px] h-[600px] rounded-full bg-amber-500/[0.04] blur-[120px]"
          animate={{
            x: [0, -40, 0],
            y: [0, 50, 0],
            scale: [1, 1.15, 1],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
          style={{ bottom: "-20%", left: "-15%" }}
        />
        <motion.div
          className="absolute w-[400px] h-[400px] rounded-full bg-rose-500/[0.02] blur-[100px]"
          animate={{
            x: [0, 30, 0],
            y: [0, -40, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
          style={{ top: "40%", left: "30%" }}
        />
      </div>

      {/* Top Header */}
      <header className="relative z-10 px-6 py-4 liquid-glass border-b border-white/[0.08]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-semibold bg-gradient-to-r from-orange-400 via-amber-300 to-orange-400 bg-clip-text text-transparent">
              zuckies admin
            </h1>

            {/* Tab Navigation */}
            <div className="flex items-center gap-1 p-1 rounded-xl liquid-glass-pill">
              <motion.button
                onClick={() => {
                  setActiveTab("applicants");
                  setSelectedFeedback(null);
                  setSearchQuery("");
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "applicants"
                    ? "liquid-glass bg-orange-500/20 text-orange-400 shadow-[0_0_20px_rgba(251,146,60,0.15)]"
                    : "text-foreground/50 hover:text-foreground/70 hover:bg-white/5"
                }`}
              >
                <Users className="w-4 h-4" />
                applicants
              </motion.button>
              <motion.button
                onClick={() => {
                  setActiveTab("feedback");
                  setSelectedApplicant(null);
                  setSearchQuery("");
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "feedback"
                    ? "liquid-glass bg-amber-500/20 text-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.15)]"
                    : "text-foreground/50 hover:text-foreground/70 hover:bg-white/5"
                }`}
              >
                <Star className="w-4 h-4" />
                feedback
              </motion.button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-foreground/40 liquid-glass-pill px-3 py-1 rounded-full">
              hey, {adminName.toLowerCase()}
            </span>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setAssistantOpen(!assistantOpen)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                assistantOpen
                  ? "liquid-glass bg-orange-500/20 text-orange-400 shadow-[0_0_20px_rgba(251,146,60,0.2)]"
                  : "liquid-glass-pill text-foreground/50 hover:text-foreground/70"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              assistant
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05, rotate: 180 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.3 }}
              onClick={() => {
                fetchApplicants();
                fetchFeedback();
              }}
              className="liquid-glass-pill p-2 rounded-xl text-foreground/50 hover:text-foreground/70"
            >
              <RefreshCw className="w-4 h-4" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onLogout}
              className="liquid-glass-pill p-2 rounded-xl text-foreground/50 hover:text-red-400"
            >
              <LogOut className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Left Panel - List */}
        <div className="w-[400px] border-r border-white/[0.06] flex flex-col liquid-glass-light">
          {/* Search + Filter */}
          <div className="p-4 space-y-3 border-b border-white/[0.06]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30" />
              <Input
                placeholder="search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 liquid-glass-pill border-white/[0.08] text-sm focus:border-orange-500/30 focus:shadow-[0_0_20px_rgba(251,146,60,0.1)] transition-all"
              />
            </div>

            {activeTab === "applicants" && (
              <div className="flex items-center gap-2 flex-wrap">
                {["all", "pending", "accepted", "waitlisted", "rejected"].map(
                  (filter) => (
                    <motion.button
                      key={filter}
                      onClick={() => setStatusFilter(filter)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        statusFilter === filter
                          ? filter === "accepted"
                            ? "liquid-glass-pill bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                            : filter === "rejected"
                            ? "liquid-glass-pill bg-red-500/20 text-red-400 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.15)]"
                            : filter === "waitlisted"
                            ? "liquid-glass-pill bg-amber-500/20 text-amber-400 border-amber-500/30 shadow-[0_0_15px_rgba(251,191,36,0.15)]"
                            : filter === "pending"
                            ? "liquid-glass-pill bg-orange-500/20 text-orange-400 border-orange-500/30 shadow-[0_0_15px_rgba(251,146,60,0.15)]"
                            : "liquid-glass-pill bg-white/10 text-foreground/70"
                          : "text-foreground/40 hover:text-foreground/60 hover:bg-white/5 rounded-lg"
                      }`}
                    >
                      {filter}
                    </motion.button>
                  )
                )}
              </div>
            )}
          </div>

          {/* Stats Bar */}
          <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-4 text-xs liquid-glass-light">
            {activeTab === "applicants" ? (
              <>
                <span className="text-foreground/40">
                  <span className="text-foreground/70 font-medium">
                    {stats.total}
                  </span>{" "}
                  total
                </span>
                <span className="text-orange-400/70">
                  <span className="text-orange-400 font-medium">
                    {stats.pending}
                  </span>{" "}
                  pending
                </span>
                <span className="text-emerald-400/70">
                  <span className="text-emerald-400 font-medium">
                    {stats.accepted}
                  </span>{" "}
                  accepted
                </span>
              </>
            ) : (
              <>
                <span className="text-foreground/40">
                  <span className="text-foreground/70 font-medium">
                    {feedbackList.length}
                  </span>{" "}
                  responses
                </span>
                <span className="text-amber-400/70">
                  <span className="text-amber-400 font-medium">
                    {avgRating}
                  </span>{" "}
                  avg rating
                </span>
              </>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === "applicants" ? (
              loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-sm text-foreground/40">loading...</div>
                </div>
              ) : filteredApplicants.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Users className="w-10 h-10 text-foreground/10 mx-auto mb-2" />
                    <p className="text-sm text-foreground/40">
                      no applicants found
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 space-y-2">
                  {filteredApplicants.map((applicant) => (
                    <motion.button
                      key={applicant.email}
                      onClick={() => {
                        setSelectedApplicant(applicant);
                        setSelectedFeedback(null);
                      }}
                      whileHover={{ scale: 1.01, x: 4 }}
                      whileTap={{ scale: 0.99 }}
                      className={`w-full text-left p-4 rounded-2xl transition-all ${
                        selectedApplicant?.email === applicant.email
                          ? "liquid-glass bg-orange-500/10 border border-orange-500/20 shadow-[0_0_30px_rgba(251,146,60,0.1)]"
                          : "liquid-glass-pill hover:bg-white/[0.08] border border-transparent"
                      }`}
                      layout
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">
                              {applicant.applicant_data?.name || "unnamed"}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${getStatusStyle(
                                applicant.applicant_data?.application_status ||
                                  "pending"
                              )}`}
                            >
                              {getStatusIcon(
                                applicant.applicant_data?.application_status ||
                                  "pending"
                              )}
                              {applicant.applicant_data?.application_status ||
                                "pending"}
                            </span>
                          </div>
                          <p className="text-xs text-foreground/40 truncate mt-0.5">
                            {applicant.applicant_data?.email}
                          </p>
                          <p className="text-xs text-foreground/30 mt-1">
                            {applicant.applicant_data?.engineering_area} •{" "}
                            {applicant.applicant_data?.skill_level}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-foreground/20 flex-shrink-0" />
                      </div>
                    </motion.button>
                  ))}
                </div>
              )
            ) : filteredFeedback.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Star className="w-10 h-10 text-foreground/10 mx-auto mb-2" />
                  <p className="text-sm text-foreground/40">no feedback yet</p>
                </div>
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {filteredFeedback.map((feedback) => (
                  <motion.button
                    key={feedback._id}
                    onClick={() => {
                      setSelectedFeedback(feedback);
                      setSelectedApplicant(null);
                    }}
                    whileHover={{ scale: 1.01, x: 4 }}
                    whileTap={{ scale: 0.99 }}
                    className={`w-full text-left p-4 rounded-2xl transition-all ${
                      selectedFeedback?._id === feedback._id
                        ? "liquid-glass bg-amber-500/10 border border-amber-500/20 shadow-[0_0_30px_rgba(251,191,36,0.1)]"
                        : "liquid-glass-pill hover:bg-white/[0.08] border border-transparent"
                    }`}
                    layout
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-0.5">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-3 h-3 ${
                                  i < feedback.rating
                                    ? "text-amber-400 fill-amber-400"
                                    : "text-foreground/10"
                                }`}
                              />
                            ))}
                          </div>
                          {feedback.category && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-foreground/40">
                              {feedback.category}
                            </span>
                          )}
                        </div>
                        {feedback.name && (
                          <p className="text-sm font-medium mt-1">
                            {feedback.name}
                          </p>
                        )}
                        {feedback.feedback && (
                          <p className="text-xs text-foreground/40 line-clamp-2 mt-1">
                            {feedback.feedback}
                          </p>
                        )}
                        <p className="text-[10px] text-foreground/30 mt-1.5">
                          {new Date(feedback.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-foreground/20 flex-shrink-0" />
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center Panel - Detail View */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <AnimatePresence mode="wait">
            {selectedApplicant ? (
              <motion.div
                key="applicant-detail"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2, ease: easing }}
                className="flex-1 overflow-y-auto"
              >
                {/* Header */}
                <div className="sticky top-0 z-10 px-6 py-5 border-b border-white/[0.06] liquid-glass backdrop-blur-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                        {selectedApplicant.applicant_data?.name}
                      </h2>
                      <p className="text-sm text-foreground/40 mt-0.5">
                        {selectedApplicant.applicant_data?.email}
                      </p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1, rotate: 90 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setSelectedApplicant(null)}
                      className="liquid-glass-pill p-2 rounded-xl text-foreground/50 hover:text-foreground/70"
                    >
                      <X className="w-4 h-4" />
                    </motion.button>
                  </div>

                  {/* Action Buttons */}
                  {selectedApplicant.applicant_data?.application_status ===
                    "pending" && (
                    <div className="flex items-center gap-3 mt-5">
                      <motion.button
                        whileHover={{ scale: 1.02, y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() =>
                          updateApplicationStatus(
                            selectedApplicant.email,
                            "accepted"
                          )
                        }
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-sm font-medium shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:shadow-[0_0_30px_rgba(16,185,129,0.25)] transition-all"
                      >
                        <CheckCircle className="w-4 h-4" />
                        accept
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02, y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() =>
                          updateApplicationStatus(
                            selectedApplicant.email,
                            "waitlisted"
                          )
                        }
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl liquid-glass-pill border-amber-500/30 text-amber-400 text-sm font-medium hover:bg-amber-500/10 transition-all"
                      >
                        <Clock className="w-4 h-4" />
                        waitlist
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02, y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() =>
                          updateApplicationStatus(
                            selectedApplicant.email,
                            "rejected"
                          )
                        }
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl liquid-glass-pill border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/10 transition-all"
                      >
                        <XCircle className="w-4 h-4" />
                        reject
                      </motion.button>
                    </div>
                  )}

                  {selectedApplicant.applicant_data?.application_status !==
                    "pending" && (
                    <div
                      className={`inline-flex items-center gap-2 mt-4 px-3 py-1.5 rounded-lg border ${getStatusStyle(
                        selectedApplicant.applicant_data?.application_status
                      )}`}
                    >
                      {getStatusIcon(
                        selectedApplicant.applicant_data?.application_status
                      )}
                      <span className="text-sm font-medium">
                        {selectedApplicant.applicant_data?.application_status}
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                  {/* Profile Section */}
                  <section>
                    <h3 className="text-xs font-semibold text-foreground/50 uppercase tracking-wide mb-3">
                      profile
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <InfoBlock
                        label="engineering area"
                        value={
                          selectedApplicant.applicant_data?.engineering_area
                        }
                      />
                      <InfoBlock
                        label="skill level"
                        value={selectedApplicant.applicant_data?.skill_level}
                      />
                      <InfoBlock
                        label="time commitment"
                        value={
                          selectedApplicant.applicant_data?.time_commitment
                        }
                      />
                      <InfoBlock
                        label="learning style"
                        value={selectedApplicant.applicant_data?.learning_style}
                      />
                      <InfoBlock
                        label="tech focus"
                        value={selectedApplicant.applicant_data?.tech_focus}
                      />
                      <InfoBlock
                        label="whatsapp"
                        value={selectedApplicant.applicant_data?.whatsapp}
                      />
                    </div>
                  </section>

                  {/* Goals Section */}
                  <section>
                    <h3 className="text-xs font-semibold text-foreground/50 uppercase tracking-wide mb-3">
                      goals & motivation
                    </h3>
                    <div className="space-y-4">
                      {selectedApplicant.applicant_data?.career_goals && (
                        <TextBlock
                          label="career goals"
                          value={selectedApplicant.applicant_data.career_goals}
                        />
                      )}
                      {selectedApplicant.applicant_data?.improvement_goals && (
                        <TextBlock
                          label="improvement goals"
                          value={
                            selectedApplicant.applicant_data.improvement_goals
                          }
                        />
                      )}
                      {selectedApplicant.applicant_data?.success_definition && (
                        <TextBlock
                          label="success definition"
                          value={
                            selectedApplicant.applicant_data.success_definition
                          }
                        />
                      )}
                    </div>
                  </section>

                  {/* Projects Section */}
                  {selectedApplicant.applicant_data?.projects && (
                    <section>
                      <h3 className="text-xs font-semibold text-foreground/50 uppercase tracking-wide mb-3">
                        projects & experience
                      </h3>
                      <TextBlock
                        value={selectedApplicant.applicant_data.projects}
                      />
                    </section>
                  )}

                  {/* Links Section */}
                  <section>
                    <h3 className="text-xs font-semibold text-foreground/50 uppercase tracking-wide mb-3">
                      links
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedApplicant.applicant_data?.github &&
                        selectedApplicant.applicant_data.github !== "N/A" &&
                        !selectedApplicant.applicant_data.github.includes(
                          "skipped"
                        ) && (
                          <LinkButton
                            href={selectedApplicant.applicant_data.github}
                            label="github"
                          />
                        )}
                      {selectedApplicant.applicant_data?.linkedin &&
                        selectedApplicant.applicant_data.linkedin !== "N/A" &&
                        !selectedApplicant.applicant_data.linkedin.includes(
                          "skipped"
                        ) && (
                          <LinkButton
                            href={selectedApplicant.applicant_data.linkedin}
                            label="linkedin"
                          />
                        )}
                      {selectedApplicant.applicant_data?.portfolio &&
                        selectedApplicant.applicant_data.portfolio !== "N/A" &&
                        !selectedApplicant.applicant_data.portfolio.includes(
                          "skipped"
                        ) && (
                          <LinkButton
                            href={selectedApplicant.applicant_data.portfolio}
                            label="portfolio"
                          />
                        )}
                    </div>
                  </section>

                  {/* Notes Section */}
                  <section>
                    <h3 className="text-xs font-semibold text-orange-400/70 uppercase tracking-wide mb-3">
                      review notes
                    </h3>
                    <textarea
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="add your notes here..."
                      className="w-full h-32 p-4 text-sm rounded-2xl liquid-glass-pill border-white/[0.08] resize-none focus:outline-none focus:border-orange-500/30 focus:shadow-[0_0_30px_rgba(251,146,60,0.1)] transition-all"
                    />
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={saveReviewNotes}
                      disabled={savingNotes}
                      className="mt-3 px-4 py-2.5 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30 text-sm font-medium shadow-[0_0_20px_rgba(251,146,60,0.15)] hover:shadow-[0_0_30px_rgba(251,146,60,0.25)] disabled:opacity-50 transition-all"
                    >
                      {savingNotes ? "saving..." : "save notes"}
                    </motion.button>
                  </section>

                  {/* Metadata */}
                  <section className="pt-4 border-t border-white/5">
                    <div className="text-xs text-foreground/30 space-y-1">
                      <p>
                        submitted:{" "}
                        {selectedApplicant.applicant_data?.submitted_at
                          ? new Date(
                              selectedApplicant.applicant_data.submitted_at
                            ).toLocaleString()
                          : "—"}
                      </p>
                      {selectedApplicant.applicant_data?.reviewed_at && (
                        <p>
                          reviewed:{" "}
                          {new Date(
                            selectedApplicant.applicant_data.reviewed_at
                          ).toLocaleString()}
                          {selectedApplicant.applicant_data?.reviewed_by &&
                            ` by ${selectedApplicant.applicant_data.reviewed_by}`}
                        </p>
                      )}
                    </div>
                  </section>
                </div>
              </motion.div>
            ) : selectedFeedback ? (
              <motion.div
                key="feedback-detail"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2, ease: easing }}
                className="flex-1 overflow-y-auto"
              >
                {/* Header */}
                <div className="sticky top-0 z-10 px-6 py-5 border-b border-white/[0.06] liquid-glass backdrop-blur-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                        feedback details
                      </h2>
                      <div className="flex items-center gap-1 mt-2">
                        {[...Array(5)].map((_, i) => (
                          <motion.div
                            key={i}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: i * 0.05 }}
                          >
                            <Star
                              className={`w-5 h-5 ${
                                i < selectedFeedback.rating
                                  ? "text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                                  : "text-foreground/10"
                              }`}
                            />
                          </motion.div>
                        ))}
                        <span className="text-sm text-foreground/40 ml-2">
                          ({selectedFeedback.rating}/5)
                        </span>
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1, rotate: 90 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setSelectedFeedback(null)}
                      className="liquid-glass-pill p-2 rounded-xl text-foreground/50 hover:text-foreground/70"
                    >
                      <X className="w-4 h-4" />
                    </motion.button>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                  {selectedFeedback.category && (
                    <section>
                      <h3 className="text-xs font-semibold text-foreground/50 uppercase tracking-wide mb-2">
                        category
                      </h3>
                      <span className="inline-block px-3 py-1 rounded-full text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {selectedFeedback.category}
                      </span>
                    </section>
                  )}

                  {(selectedFeedback.name || selectedFeedback.email) && (
                    <section>
                      <h3 className="text-xs font-semibold text-foreground/50 uppercase tracking-wide mb-2">
                        submitted by
                      </h3>
                      <div className="text-sm">
                        {selectedFeedback.name && (
                          <p className="font-medium">{selectedFeedback.name}</p>
                        )}
                        {selectedFeedback.email && (
                          <p className="text-foreground/40">
                            {selectedFeedback.email}
                          </p>
                        )}
                      </div>
                    </section>
                  )}

                  {selectedFeedback.feedback && (
                    <section>
                      <h3 className="text-xs font-semibold text-foreground/50 uppercase tracking-wide mb-2">
                        feedback
                      </h3>
                      <div className="p-4 rounded-lg bg-white/5 border border-white/10 text-sm leading-relaxed">
                        {selectedFeedback.feedback}
                      </div>
                    </section>
                  )}

                  {selectedFeedback.suggestions && (
                    <section>
                      <h3 className="text-xs font-semibold text-foreground/50 uppercase tracking-wide mb-2">
                        suggestions
                      </h3>
                      <div className="p-4 rounded-lg bg-white/5 border border-white/10 text-sm leading-relaxed">
                        {selectedFeedback.suggestions}
                      </div>
                    </section>
                  )}

                  <section className="pt-4 border-t border-white/5">
                    <div className="text-xs text-foreground/30 space-y-1">
                      <p>
                        submitted:{" "}
                        {new Date(selectedFeedback.created_at).toLocaleString()}
                      </p>
                      <p>
                        session: {selectedFeedback.session_id.slice(0, 16)}...
                      </p>
                      {selectedFeedback.onboarding_state && (
                        <p>state: {selectedFeedback.onboarding_state}</p>
                      )}
                    </div>
                  </section>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex items-center justify-center"
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, ease: easing }}
                  className="text-center"
                >
                  <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="w-20 h-20 mx-auto mb-5 rounded-2xl liquid-glass flex items-center justify-center shadow-[0_0_40px_rgba(251,146,60,0.1)]"
                  >
                    {activeTab === "applicants" ? (
                      <Users className="w-9 h-9 text-orange-400/50" />
                    ) : (
                      <Star className="w-9 h-9 text-amber-400/50" />
                    )}
                  </motion.div>
                  <p className="text-foreground/40 text-sm">
                    select{" "}
                    {activeTab === "applicants" ? "an applicant" : "feedback"}{" "}
                    to view details
                  </p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Panel - Assistant */}
        <AnimatePresence>
          {assistantOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 400, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: easing }}
              className="border-l border-white/[0.06] flex flex-col overflow-hidden liquid-glass-light"
            >
              <div className="p-4 border-b border-white/[0.06] liquid-glass">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <motion.div
                      animate={{ rotate: [0, 15, -15, 0] }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    >
                      <Sparkles className="w-5 h-5 text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.5)]" />
                    </motion.div>
                    <span className="font-medium text-sm bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
                      assistant
                    </span>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setAssistantOpen(false)}
                    className="liquid-glass-pill p-2 rounded-xl text-foreground/50 hover:text-foreground/70"
                  >
                    <X className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
                {chatMessages.map((msg, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.3, ease: easing }}
                    className={`flex ${
                      msg.role === "admin" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] px-4 py-2.5 text-sm ${
                        msg.role === "admin"
                          ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl rounded-br-md shadow-[0_4px_20px_rgba(251,146,60,0.3)]"
                          : "liquid-glass-pill text-foreground/80 rounded-2xl rounded-bl-md"
                      }`}
                    >
                      {msg.role === "admin" ? (
                        msg.content
                      ) : (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ children }) => (
                              <p className="mb-2 last:mb-0">{children}</p>
                            ),
                            strong: ({ children }) => (
                              <strong className="font-semibold text-foreground">
                                {children}
                              </strong>
                            ),
                            em: ({ children }) => (
                              <em className="text-orange-400/90">{children}</em>
                            ),
                            ul: ({ children }) => (
                              <ul className="mb-2 space-y-1 ml-1">
                                {children}
                              </ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="mb-2 space-y-1 ml-1 list-decimal list-inside">
                                {children}
                              </ol>
                            ),
                            li: ({ children }) => (
                              <li className="flex gap-2">
                                <span className="text-orange-400/60">•</span>
                                <span>{children}</span>
                              </li>
                            ),
                            a: ({ href, children }) => (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-orange-400 hover:text-orange-300 underline underline-offset-2 transition-colors"
                              >
                                {children}
                              </a>
                            ),
                            code: ({ children }) => (
                              <code className="text-orange-400/90 text-xs font-mono bg-foreground/10 px-1.5 py-0.5 rounded">
                                {children}
                              </code>
                            ),
                            pre: ({ children }) => (
                              <pre className="bg-foreground/10 p-3 rounded-xl overflow-x-auto my-2 text-xs font-mono">
                                {children}
                              </pre>
                            ),
                            blockquote: ({ children }) => (
                              <blockquote className="border-l-2 border-orange-400/30 pl-3 my-2 text-foreground/70 italic">
                                {children}
                              </blockquote>
                            ),
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      )}
                    </div>
                  </motion.div>
                ))}
                {chatLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start"
                  >
                    <div className="liquid-glass-pill px-4 py-3 rounded-2xl rounded-bl-md flex gap-1.5">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="w-2 h-2 bg-orange-400/60 rounded-full"
                          animate={{ y: [0, -6, 0] }}
                          transition={{
                            duration: 0.6,
                            repeat: Infinity,
                            delay: i * 0.15,
                            ease: "easeInOut",
                          }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <div className="p-4 border-t border-white/[0.06] liquid-glass">
                <div className="flex gap-2">
                  <Input
                    placeholder="ask anything..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    disabled={chatLoading}
                    className="flex-1 liquid-glass-pill border-white/[0.08] text-sm focus:border-orange-500/30 focus:shadow-[0_0_20px_rgba(251,146,60,0.1)] transition-all"
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSendMessage}
                    disabled={chatLoading || !chatInput.trim()}
                    className="px-3 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-[0_4px_20px_rgba(251,146,60,0.3)] disabled:opacity-50 disabled:shadow-none transition-all"
                  >
                    <Send className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Helper Components
function InfoBlock({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="p-4 rounded-2xl liquid-glass-pill border-white/[0.06] hover:border-white/[0.1] transition-all">
      <p className="text-[10px] text-foreground/40 uppercase tracking-wide mb-1.5">
        {label}
      </p>
      <p className="text-sm text-foreground/80">{value}</p>
    </div>
  );
}

function TextBlock({ label, value }: { label?: string; value: string }) {
  return (
    <div className="p-5 rounded-2xl liquid-glass border-white/[0.06]">
      {label && (
        <p className="text-[10px] text-foreground/40 uppercase tracking-wide mb-2.5">
          {label}
        </p>
      )}
      <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">
        {value}
      </p>
    </div>
  );
}

function LinkButton({ href, label }: { href: string; label: string }) {
  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl liquid-glass-pill border-white/[0.08] text-sm text-foreground/70 hover:text-orange-400 hover:border-orange-500/30 hover:shadow-[0_0_20px_rgba(251,146,60,0.1)] transition-all"
    >
      <ExternalLink className="w-3.5 h-3.5" />
      {label}
    </motion.a>
  );
}
