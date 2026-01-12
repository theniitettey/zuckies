"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ChatMessage from "@/components/chat-message";
import {
  Search,
  Send,
  Menu,
  X,
  CheckCircle,
  Clock,
  AlertCircle,
  MoreVertical,
  MessageCircle,
  Users,
  TrendingUp,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";

interface Applicant {
  session_id: string;
  state: string;
  applicant_data: {
    name: string;
    email: string;
    engineering_area: string;
    skill_level: string;
    career_goals: string;
    github?: string;
    linkedin?: string;
    portfolio?: string;
    projects?: string;
    time_commitment?: string;
    application_status: "pending" | "accepted" | "rejected";
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

const chatEasing: [number, number, number, number] = [0.16, 1, 0.3, 1];

export default function AdminInterface({
  onLogout,
  adminName = "Admin",
}: AdminInterfaceProps) {
  const [currentView, setCurrentView] = useState<"applicants" | "feedback">(
    "applicants"
  );
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [filteredApplicants, setFilteredApplicants] = useState<Applicant[]>([]);
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [filteredFeedback, setFilteredFeedback] = useState<FeedbackItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(
    null
  );
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(
    null
  );
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  // Admin assistant chat state
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<
    { role: "admin" | "assistant"; content: string }[]
  >([
    {
      role: "assistant",
      content:
        "hey there. need help managing applicants or just want to bounce ideas off me? i'm here.",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Review notes state
  const [reviewNotes, setReviewNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // Fetch applicants on mount
  useEffect(() => {
    fetchApplicants();
    fetchFeedback();
  }, []);

  // Filter applicants whenever search or status filter changes
  useEffect(() => {
    if (currentView === "applicants") {
      let filtered = applicants;

      if (statusFilter !== "all") {
        filtered = filtered.filter(
          (app) => app.applicant_data?.application_status === statusFilter
        );
      }

      if (searchQuery) {
        filtered = filtered.filter((app) => {
          const query = searchQuery.toLowerCase();
          return (
            app.applicant_data?.name?.toLowerCase().includes(query) ||
            app.applicant_data?.email?.toLowerCase().includes(query) ||
            app.session_id.toLowerCase().includes(query)
          );
        });
      }

      setFilteredApplicants(filtered);
    } else if (currentView === "feedback") {
      let filtered = feedbackList;

      if (searchQuery) {
        filtered = filtered.filter((fb) => {
          const query = searchQuery.toLowerCase();
          return (
            fb.name?.toLowerCase().includes(query) ||
            fb.email?.toLowerCase().includes(query) ||
            fb.feedback?.toLowerCase().includes(query) ||
            fb.session_id.toLowerCase().includes(query)
          );
        });
      }

      setFilteredFeedback(filtered);
    }
  }, [applicants, feedbackList, searchQuery, statusFilter, currentView]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Load review notes when applicant is selected
  useEffect(() => {
    if (selectedApplicant?.applicant_data?.review_notes) {
      setReviewNotes(selectedApplicant.applicant_data.review_notes);
    } else {
      setReviewNotes("");
    }
  }, [selectedApplicant]);

  async function fetchApplicants() {
    try {
      setLoading(true);
      const token = localStorage.getItem("admin_token");

      if (!token) {
        toast.error("no authentication token. please login again.");
        onLogout();
        return;
      }

      const response = await fetch("/api/admin/review", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast.error("unauthorized. invalid admin secret.");
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

      if (!token) {
        return;
      }

      const response = await fetch("/api/admin/feedback", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setFeedbackList(data.feedback || []);
      setFilteredFeedback(data.feedback || []);
    } catch (error) {
      console.error("Error fetching feedback:", error);
      toast.error("failed to load feedback");
    }
  }

  async function handleSendMessage() {
    if (!chatInput.trim()) return;

    // Add user message
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

      // Update session ID if new
      if (data.session_id && !chatSessionId) {
        setChatSessionId(data.session_id);
      }

      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.message },
      ]);
    } catch (error) {
      console.error("Chat error:", error);
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "couldn't process that. try again or refresh the page if it keeps happening.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  async function updateApplicationStatus(
    sessionId: string,
    status: "accepted" | "rejected"
  ) {
    try {
      const token = localStorage.getItem("admin_token");
      const response = await fetch("/api/admin/review", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          session_id: sessionId,
          application_status: status,
        }),
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
          session_id: selectedApplicant.session_id,
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
  };

  const getStatusColor = (
    status: "pending" | "accepted" | "rejected"
  ): string => {
    switch (status) {
      case "accepted":
        return "bg-green-500/10 text-green-400 border-green-500/30";
      case "rejected":
        return "bg-red-500/10 text-red-400 border-red-500/30";
      case "pending":
      default:
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === "accepted") return <CheckCircle className="w-4 h-4" />;
    if (status === "rejected") return <AlertCircle className="w-4 h-4" />;
    return <Clock className="w-4 h-4" />;
  };

  return (
    <div className="min-h-screen bg-background flex relative overflow-hidden">
      {/* Animated gradient mesh background */}
      <div className="absolute inset-0 bg-gradient-mesh opacity-60" />

      {/* Animated glow orbs - warm organic colors */}
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full bg-orange-500/10 blur-[100px]"
        animate={{
          scale: [1, 1.1, 1],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        style={{ top: "20%", left: "30%" }}
      />
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full bg-amber-500/10 blur-[80px]"
        animate={{
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

      {/* Sidebar */}
      <motion.div
        initial={false}
        animate={{ width: sidebarOpen ? 280 : 80 }}
        transition={{ duration: 0.3, ease: chatEasing }}
        className="liquid-glass-light backdrop-blur-xl border-r border-white/20 flex flex-col relative z-10"
      >
        <div className="p-6 flex items-center justify-between border-b border-white/10">
          {sidebarOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h1 className="text-lg font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
                zuckies admin
              </h1>
            </motion.div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="ml-auto hover:bg-orange-500/10"
          >
            {sidebarOpen ? (
              <X className="w-4 h-4" />
            ) : (
              <Menu className="w-4 h-4" />
            )}
          </Button>
        </div>

        <div className="flex-1 px-4 space-y-4 py-4">
          <div className="space-y-2">
            <div className="px-2 text-xs font-semibold text-orange-300/80 uppercase tracking-wide">
              {sidebarOpen && "views"}
            </div>
            <Button
              variant={currentView === "applicants" ? "default" : "ghost"}
              size="sm"
              className={`w-full justify-start ${
                currentView === "applicants"
                  ? "bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30"
                  : "hover:bg-orange-500/10"
              }`}
              onClick={() => {
                setCurrentView("applicants");
                setStatusFilter("all");
                setSearchQuery("");
                setSelectedApplicant(null);
                setSelectedFeedback(null);
              }}
            >
              <Users className="w-4 h-4 mr-2" />
              {sidebarOpen && "applicants"}
            </Button>
            <Button
              variant={currentView === "feedback" ? "default" : "ghost"}
              size="sm"
              className={`w-full justify-start ${
                currentView === "feedback"
                  ? "bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30"
                  : "hover:bg-orange-500/10"
              }`}
              onClick={() => {
                setCurrentView("feedback");
                setSearchQuery("");
                setSelectedApplicant(null);
                setSelectedFeedback(null);
              }}
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              {sidebarOpen && "feedback"}
            </Button>
          </div>

          {currentView === "applicants" && (
            <>
              <div className="h-px bg-white/10" />
              <div className="space-y-2">
                <div className="px-2 text-xs font-semibold text-orange-300/80 uppercase tracking-wide">
                  {sidebarOpen && "filters"}
                </div>
                <Button
                  variant={statusFilter === "all" ? "default" : "ghost"}
                  size="sm"
                  className={`w-full justify-start ${
                    statusFilter === "all"
                      ? "bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30"
                      : "hover:bg-orange-500/10"
                  }`}
                  onClick={() => setStatusFilter("all")}
                >
                  <Users className="w-4 h-4 mr-2" />
                  {sidebarOpen && "all"}
                </Button>
                <Button
                  variant={statusFilter === "pending" ? "default" : "ghost"}
                  size="sm"
                  className={`w-full justify-start ${
                    statusFilter === "pending"
                      ? "bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30"
                      : "hover:bg-orange-500/10"
                  }`}
                  onClick={() => setStatusFilter("pending")}
                >
                  <Clock className="w-4 h-4 mr-2" />
                  {sidebarOpen && "pending"}
                </Button>
                <Button
                  variant={statusFilter === "accepted" ? "default" : "ghost"}
                  size="sm"
                  className={`w-full justify-start ${
                    statusFilter === "accepted"
                      ? "bg-green-500/20 hover:bg-green-500/30 border border-green-500/30"
                      : "hover:bg-orange-500/10"
                  }`}
                  onClick={() => setStatusFilter("accepted")}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  {sidebarOpen && "accepted"}
                </Button>
                <Button
                  variant={statusFilter === "rejected" ? "default" : "ghost"}
                  size="sm"
                  className={`w-full justify-start ${
                    statusFilter === "rejected"
                      ? "bg-red-500/20 hover:bg-red-500/30 border border-red-500/30"
                      : "hover:bg-orange-500/10"
                  }`}
                  onClick={() => setStatusFilter("rejected")}
                >
                  <AlertCircle className="w-4 h-4 mr-2" />
                  {sidebarOpen && "rejected"}
                </Button>
              </div>
            </>
          )}

          <div className="h-px bg-white/10" />

          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3 pt-2"
            >
              <div className="text-xs font-semibold text-orange-300/80 uppercase tracking-wide">
                stats
              </div>
              <div className="text-sm space-y-2 rounded-lg bg-white/5 p-3 border border-white/10">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">total</span>
                  <span className="font-semibold text-orange-300">
                    {stats.total}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">pending</span>
                  <span className="font-semibold text-amber-300">
                    {stats.pending}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">accepted</span>
                  <span className="font-semibold text-green-300">
                    {stats.accepted}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        <div className="p-4 border-t border-white/10">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start hover:bg-red-500/10 hover:border-red-500/30"
            onClick={onLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            {sidebarOpen && "logout"}
          </Button>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative z-10">
        {/* Header */}
        <div className="liquid-glass-light border-b border-white/10 p-6 flex items-center justify-between backdrop-blur-xl">
          <div>
            <h2 className="text-2xl font-bold">
              {currentView === "applicants" ? "applications" : "user feedback"}{" "}
              dashboard
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              {currentView === "applicants" ? (
                <>
                  hey {adminName}, reviewing {filteredApplicants.length} of{" "}
                  {applicants.length} applicants
                </>
              ) : (
                <>
                  hey {adminName}, viewing {filteredFeedback.length} of{" "}
                  {feedbackList.length} feedback submissions
                </>
              )}
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={fetchApplicants}>
              refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAssistantOpen(!assistantOpen)}
              className="relative"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              assistant
              {assistantOpen && (
                <span className="absolute inset-0 bg-primary/10 rounded animate-pulse" />
              )}
            </Button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex">
          {/* Applications List */}
          <motion.div
            animate={{
              width: selectedApplicant ? "50%" : assistantOpen ? "60%" : "100%",
            }}
            transition={{ duration: 0.3, ease: chatEasing }}
            className="border-r border-border flex flex-col overflow-hidden"
          >
            {/* Search Bar */}
            <div className="p-6 border-b border-white/10 liquid-glass-light backdrop-blur-xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={
                    currentView === "applicants"
                      ? "search by name, email, or session id..."
                      : "search feedback by name, email, or content..."
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 liquid-glass-pill border-white/10"
                />
              </div>
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-y-auto">
              {currentView === "applicants" ? (
                // Applicants View
                <>
                  {loading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="text-muted-foreground text-sm">
                          loading applicants...
                        </div>
                      </div>
                    </div>
                  ) : filteredApplicants.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <TrendingUp className="w-12 h-12 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-muted-foreground">
                          no applicants found
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 p-6">
                      {filteredApplicants.map((applicant) => (
                        <motion.div
                          key={applicant.session_id}
                          layout
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          onClick={() => setSelectedApplicant(applicant)}
                          className={`p-4 rounded-lg cursor-pointer transition-all ${
                            selectedApplicant?.session_id ===
                            applicant.session_id
                              ? "liquid-glass-pill border-2 border-orange-500/50 bg-orange-500/10 glow-sm text-orange-50"
                              : "liquid-glass-pill border-2 border-white/5 hover:border-orange-500/20 hover:bg-white/5"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold">
                                  {applicant.applicant_data?.name}
                                </h3>
                                <div
                                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                                    applicant.applicant_data
                                      ?.application_status || "pending"
                                  )}`}
                                >
                                  {getStatusIcon(
                                    applicant.applicant_data
                                      ?.application_status || "pending"
                                  )}
                                  {applicant.applicant_data
                                    ?.application_status || "pending"}
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {applicant.applicant_data?.email}
                              </p>
                              <p className="text-xs text-muted-foreground mt-2">
                                {applicant.applicant_data?.engineering_area} •{" "}
                                {applicant.applicant_data?.skill_level}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                // Feedback View
                <>
                  {filteredFeedback.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <MessageCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-muted-foreground">
                          no feedback found
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 p-6">
                      {filteredFeedback.map((feedback) => (
                        <motion.div
                          key={feedback._id}
                          layout
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          onClick={() => setSelectedFeedback(feedback)}
                          className={`p-4 rounded-lg cursor-pointer transition-all ${
                            selectedFeedback?._id === feedback._id
                              ? "liquid-glass-pill border-2 border-amber-500/50 bg-amber-500/10 glow-sm text-amber-50"
                              : "liquid-glass-pill border-2 border-white/5 hover:border-amber-500/20 hover:bg-white/5"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="flex items-center gap-1">
                                  {[...Array(5)].map((_, i) => (
                                    <span
                                      key={i}
                                      className={`text-sm ${
                                        i < feedback.rating
                                          ? "text-amber-400"
                                          : "text-gray-600"
                                      }`}
                                    >
                                      ★
                                    </span>
                                  ))}
                                </div>
                                {feedback.category && (
                                  <span className="px-2 py-0.5 rounded text-xs bg-amber-400/20 text-amber-300">
                                    {feedback.category}
                                  </span>
                                )}
                              </div>
                              {(feedback.name || feedback.email) && (
                                <p className="text-sm font-medium">
                                  {feedback.name || feedback.email}
                                </p>
                              )}
                              {feedback.feedback && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {feedback.feedback}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground/50 mt-2">
                                {new Date(
                                  feedback.created_at
                                ).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>

          {/* Detail Panel */}
          <AnimatePresence>
            {((currentView === "applicants" && selectedApplicant) ||
              (currentView === "feedback" && selectedFeedback)) && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3, ease: chatEasing }}
                className="flex-1 h-full liquid-glass border-l border-white/10 flex flex-col relative backdrop-blur-xl"
              >
                {/* Applicant Detail Panel */}
                {currentView === "applicants" &&
                  selectedApplicant &&
                  selectedApplicant.applicant_data && (
                    <div className="flex flex-col h-full">
                      {/* Header */}
                      <div className="p-6 border-b border-white/10 liquid-glass-light backdrop-blur-xl">
                        <div className="flex items-start justify-between mb-4">
                          <h3 className="font-semibold text-sm">
                            {selectedApplicant.applicant_data?.name}
                          </h3>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedApplicant(null)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>

                        {/* Action Buttons */}
                        {selectedApplicant.applicant_data
                          ?.application_status === "pending" && (
                          <div className="flex gap-2 mb-4">
                            <Button
                              size="sm"
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                              onClick={() =>
                                updateApplicationStatus(
                                  selectedApplicant.session_id,
                                  "accepted"
                                )
                              }
                            >
                              approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() =>
                                updateApplicationStatus(
                                  selectedApplicant.session_id,
                                  "rejected"
                                )
                              }
                            >
                              reject
                            </Button>
                          </div>
                        )}

                        {selectedApplicant.applicant_data
                          ?.application_status !== "pending" && (
                          <div className="mb-4 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                            status:{" "}
                            <span className="font-semibold capitalize">
                              {
                                selectedApplicant.applicant_data
                                  ?.application_status
                              }
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Details */}
                      <div
                        className={`overflow-y-auto p-6 space-y-4 min-h-0 ${
                          !assistantOpen ? "flex-1" : ""
                        }`}
                      >
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                            contact
                          </div>
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">
                                email:
                              </span>{" "}
                              <a
                                href={`mailto:${selectedApplicant.applicant_data?.email}`}
                                className="text-primary hover:underline text-xs"
                              >
                                {selectedApplicant.applicant_data?.email}
                              </a>
                            </div>
                          </div>
                        </div>

                        <div className="h-px bg-border" />

                        <div>
                          <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                            profile
                          </div>
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">
                                engineering area:
                              </span>{" "}
                              <span className="font-medium text-xs">
                                {
                                  selectedApplicant.applicant_data
                                    ?.engineering_area
                                }
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">
                                skill level:
                              </span>{" "}
                              <span className="font-medium text-xs">
                                {selectedApplicant.applicant_data?.skill_level}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">
                                time commitment:
                              </span>{" "}
                              <span className="font-medium text-xs">
                                {selectedApplicant.applicant_data
                                  ?.time_commitment || "not specified"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="h-px bg-border" />

                        <div>
                          <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                            goals & interests
                          </div>
                          <div className="text-xs leading-relaxed text-foreground bg-white/5 p-3 rounded border border-white/10">
                            {selectedApplicant.applicant_data?.career_goals}
                          </div>
                        </div>

                        {selectedApplicant.applicant_data?.projects && (
                          <>
                            <div className="h-px bg-border" />
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                                projects & experience
                              </div>
                              <div className="text-xs leading-relaxed text-foreground bg-white/5 p-3 rounded border border-white/10">
                                {selectedApplicant.applicant_data?.projects}
                              </div>
                            </div>
                          </>
                        )}

                        <div className="h-px bg-border" />

                        <div>
                          <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                            links
                          </div>
                          <div className="space-y-2 text-xs">
                            {selectedApplicant.applicant_data?.github && (
                              <div>
                                <a
                                  href={selectedApplicant.applicant_data.github}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-primary hover:underline flex items-center gap-2"
                                >
                                  → github
                                </a>
                              </div>
                            )}
                            {selectedApplicant.applicant_data?.linkedin && (
                              <div>
                                <a
                                  href={
                                    selectedApplicant.applicant_data.linkedin
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-primary hover:underline flex items-center gap-2"
                                >
                                  → linkedin
                                </a>
                              </div>
                            )}
                            {selectedApplicant.applicant_data?.portfolio && (
                              <div>
                                <a
                                  href={
                                    selectedApplicant.applicant_data.portfolio
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-primary hover:underline flex items-center gap-2"
                                >
                                  → portfolio
                                </a>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="h-px bg-border" />

                        <div>
                          <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                            metadata
                          </div>
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <div>
                              <span>submitted:</span>{" "}
                              {selectedApplicant.applicant_data?.submitted_at
                                ? new Date(
                                    selectedApplicant.applicant_data.submitted_at
                                  ).toLocaleDateString()
                                : "—"}
                            </div>
                            <div>
                              <span>session id:</span>{" "}
                              <code className="text-xs bg-white/5 px-1 rounded">
                                {selectedApplicant.session_id.slice(0, 8)}...
                              </code>
                            </div>
                            {selectedApplicant.applicant_data?.reviewed_at && (
                              <div>
                                <span>reviewed:</span>{" "}
                                {new Date(
                                  selectedApplicant.applicant_data.reviewed_at
                                ).toLocaleDateString()}
                                {selectedApplicant.applicant_data
                                  ?.reviewed_by &&
                                  ` by ${selectedApplicant.applicant_data.reviewed_by}`}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="h-px bg-border" />

                        <div>
                          <div className="text-xs font-semibold text-orange-300/80 uppercase mb-2">
                            feedback & notes
                          </div>

                          {selectedApplicant.applicant_data?.review_notes && (
                            <div className="mb-4 p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
                              <div className="text-xs font-semibold text-orange-300 mb-2">
                                existing notes:
                              </div>
                              <p className="text-xs text-orange-50/90 leading-relaxed whitespace-pre-wrap break-words">
                                {selectedApplicant.applicant_data.review_notes}
                              </p>
                            </div>
                          )}

                          <div className="mb-3">
                            <label className="text-xs font-semibold text-muted-foreground mb-2 block">
                              add or edit notes
                            </label>
                            <textarea
                              placeholder="your feedback here..."
                              value={reviewNotes}
                              onChange={(e) => setReviewNotes(e.target.value)}
                              className="w-full h-24 text-xs p-3 rounded border border-white/10 bg-white/5 text-foreground resize-none focus:outline-none focus:border-orange-500/50 focus:bg-white/10 transition"
                            />
                          </div>
                          <Button
                            size="sm"
                            onClick={saveReviewNotes}
                            disabled={savingNotes}
                            className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                          >
                            {savingNotes ? "saving..." : "save notes"}
                          </Button>
                        </div>
                      </div>

                      {/* Chat Section (when assistant is toggled) */}
                      {assistantOpen && (
                        <div className="border-t border-white/10 flex-1 overflow-hidden flex flex-col min-h-0">
                          {/* Chat Area */}
                          <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0">
                            {chatMessages.map((msg, idx) => (
                              <ChatMessage
                                key={idx}
                                message={{
                                  id: `msg-${idx}`,
                                  role:
                                    msg.role === "admin" ? "user" : "assistant",
                                  content: msg.content,
                                  timestamp: Date.now(),
                                }}
                              />
                            ))}
                            {chatLoading && (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex gap-2"
                              >
                                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                                <div
                                  className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                                  style={{ animationDelay: "0.2s" }}
                                />
                                <div
                                  className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                                  style={{ animationDelay: "0.4s" }}
                                />
                              </motion.div>
                            )}
                            <div ref={chatEndRef} />
                          </div>

                          {/* Chat Input */}
                          <div className="p-6 border-t border-white/10 liquid-glass-light backdrop-blur-xl">
                            <div className="flex gap-2">
                              <Input
                                placeholder="ask the assistant..."
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyPress={(e) => {
                                  if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage();
                                  }
                                }}
                                disabled={chatLoading}
                                className="flex-1 liquid-glass-pill border-white/10"
                              />
                              <Button
                                size="sm"
                                onClick={handleSendMessage}
                                disabled={chatLoading || !chatInput.trim()}
                                className="bg-orange-600 hover:bg-orange-700 text-white"
                              >
                                <Send className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                {/* Feedback Detail Panel */}
                {currentView === "feedback" && selectedFeedback && (
                  <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="p-6 border-b border-white/10 liquid-glass-light backdrop-blur-xl">
                      <div className="flex items-start justify-between mb-4">
                        <h3 className="font-semibold text-sm">
                          feedback details
                        </h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedFeedback(null)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0">
                      {/* Rating */}
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                          rating
                        </div>
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <span
                              key={i}
                              className={`text-2xl ${
                                i < selectedFeedback.rating
                                  ? "text-amber-400"
                                  : "text-gray-600"
                              }`}
                            >
                              ★
                            </span>
                          ))}
                          <span className="ml-2 text-sm text-muted-foreground">
                            ({selectedFeedback.rating}/5)
                          </span>
                        </div>
                      </div>

                      <div className="h-px bg-border" />

                      {/* Category */}
                      {selectedFeedback.category && (
                        <>
                          <div>
                            <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                              category
                            </div>
                            <span className="inline-block px-3 py-1 rounded-full text-xs bg-amber-400/20 text-amber-300 border border-amber-500/30">
                              {selectedFeedback.category}
                            </span>
                          </div>
                          <div className="h-px bg-border" />
                        </>
                      )}

                      {/* User Info */}
                      {(selectedFeedback.name || selectedFeedback.email) && (
                        <>
                          <div>
                            <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                              submitted by
                            </div>
                            <div className="text-xs space-y-1">
                              {selectedFeedback.name && (
                                <div className="text-foreground">
                                  {selectedFeedback.name}
                                </div>
                              )}
                              {selectedFeedback.email && (
                                <div className="text-muted-foreground">
                                  {selectedFeedback.email}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="h-px bg-border" />
                        </>
                      )}

                      {/* Feedback Text */}
                      {selectedFeedback.feedback && (
                        <>
                          <div>
                            <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                              feedback
                            </div>
                            <div className="text-xs leading-relaxed text-foreground bg-white/5 p-3 rounded border border-white/10">
                              {selectedFeedback.feedback}
                            </div>
                          </div>
                          <div className="h-px bg-border" />
                        </>
                      )}

                      {/* Suggestions */}
                      {selectedFeedback.suggestions && (
                        <>
                          <div>
                            <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                              suggestions
                            </div>
                            <div className="text-xs leading-relaxed text-foreground bg-white/5 p-3 rounded border border-white/10">
                              {selectedFeedback.suggestions}
                            </div>
                          </div>
                          <div className="h-px bg-border" />
                        </>
                      )}

                      {/* Onboarding State */}
                      {selectedFeedback.onboarding_state && (
                        <>
                          <div>
                            <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                              onboarding state
                            </div>
                            <div className="text-xs text-foreground bg-white/5 p-3 rounded border border-white/10">
                              <code className="text-xs">
                                {selectedFeedback.onboarding_state}
                              </code>
                            </div>
                          </div>
                          <div className="h-px bg-border" />
                        </>
                      )}

                      {/* Metadata */}
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                          metadata
                        </div>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div>
                            <span>submitted:</span>{" "}
                            {new Date(
                              selectedFeedback.created_at
                            ).toLocaleString()}
                          </div>
                          <div>
                            <span>session id:</span>{" "}
                            <code className="text-xs bg-white/5 px-1 rounded">
                              {selectedFeedback.session_id.slice(0, 12)}...
                            </code>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Assistant Panel Below Detail */}
                {assistantOpen && !selectedApplicant && !selectedFeedback && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3, ease: chatEasing }}
                    className="w-[450px] h-full liquid-glass border-l border-white/10 flex flex-col relative backdrop-blur-xl overflow-hidden"
                  >
                    {/* Chat Area */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0">
                      {chatMessages.map((msg, idx) => (
                        <ChatMessage
                          key={idx}
                          message={{
                            id: `msg-${idx}`,
                            role: msg.role === "admin" ? "user" : "assistant",
                            content: msg.content,
                            timestamp: Date.now(),
                          }}
                        />
                      ))}
                      {chatLoading && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex gap-2"
                        >
                          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                          <div
                            className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                            style={{ animationDelay: "0.2s" }}
                          />
                          <div
                            className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                            style={{ animationDelay: "0.4s" }}
                          />
                        </motion.div>
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    {/* Chat Input */}
                    <div className="p-6 border-t border-white/10 liquid-glass-light backdrop-blur-xl">
                      <div className="flex gap-2">
                        <Input
                          placeholder="ask the assistant..."
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage();
                            }
                          }}
                          disabled={chatLoading}
                          className="flex-1 liquid-glass-pill border-white/10"
                        />
                        <Button
                          size="sm"
                          onClick={handleSendMessage}
                          disabled={chatLoading || !chatInput.trim()}
                          className="bg-orange-600 hover:bg-orange-700 text-white"
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Assistant Panel (Standalone - when no detail view) */}
          <AnimatePresence>
            {assistantOpen && !selectedApplicant && !selectedFeedback && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3, ease: chatEasing }}
                className="w-[450px] h-full liquid-glass border-l border-white/10 flex flex-col relative backdrop-blur-xl overflow-hidden"
              >
                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0">
                  {chatMessages.map((msg, idx) => (
                    <ChatMessage
                      key={idx}
                      message={{
                        id: `msg-${idx}`,
                        role: msg.role === "admin" ? "user" : "assistant",
                        content: msg.content,
                        timestamp: Date.now(),
                      }}
                    />
                  ))}
                  {chatLoading && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex gap-2"
                    >
                      <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                      <div
                        className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      />
                      <div
                        className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"
                        style={{ animationDelay: "0.4s" }}
                      />
                    </motion.div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Chat Input */}
                <div className="p-6 border-t border-white/10 liquid-glass-light backdrop-blur-xl">
                  <div className="flex gap-2">
                    <Input
                      placeholder="ask the assistant..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      disabled={chatLoading}
                      className="flex-1 liquid-glass-pill border-white/10"
                    />
                    <Button
                      size="sm"
                      onClick={handleSendMessage}
                      disabled={chatLoading || !chatInput.trim()}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
