"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    application_status: "pending" | "accepted" | "rejected";
    submitted_at: string;
  };
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
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [filteredApplicants, setFilteredApplicants] = useState<Applicant[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(
    null
  );
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  // Admin assistant chat state
  const [assistantOpen, setAssistantOpen] = useState(false);
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

  // Fetch applicants on mount
  useEffect(() => {
    fetchApplicants();
  }, []);

  // Filter applicants whenever search or status filter changes
  useEffect(() => {
    let filtered = applicants;

    if (statusFilter !== "all") {
      filtered = filtered.filter(
        (app) => app.applicant_data.application_status === statusFilter
      );
    }

    if (searchQuery) {
      filtered = filtered.filter((app) => {
        const query = searchQuery.toLowerCase();
        return (
          app.applicant_data.name.toLowerCase().includes(query) ||
          app.applicant_data.email.toLowerCase().includes(query) ||
          app.session_id.toLowerCase().includes(query)
        );
      });
    }

    setFilteredApplicants(filtered);
  }, [applicants, searchQuery, statusFilter]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  async function fetchApplicants() {
    try {
      setLoading(true);
      const secret = localStorage.getItem("admin_secret");
      const response = await fetch(
        `/api/admin/review?secret=${encodeURIComponent(secret || "")}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        }
      );

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
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();
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
      const secret = localStorage.getItem("admin_secret");
      const response = await fetch("/api/admin/review", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          secret,
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

  const stats = {
    total: applicants.length,
    pending: applicants.filter(
      (a) => a.applicant_data.application_status === "pending"
    ).length,
    accepted: applicants.filter(
      (a) => a.applicant_data.application_status === "accepted"
    ).length,
    rejected: applicants.filter(
      (a) => a.applicant_data.application_status === "rejected"
    ).length,
  };

  const getStatusColor = (
    status: "pending" | "accepted" | "rejected"
  ): string => {
    switch (status) {
      case "accepted":
        return "bg-green-50 text-green-700 border-green-200";
      case "rejected":
        return "bg-red-50 text-red-700 border-red-200";
      case "pending":
      default:
        return "bg-yellow-50 text-yellow-700 border-yellow-200";
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === "accepted") return <CheckCircle className="w-4 h-4" />;
    if (status === "rejected") return <AlertCircle className="w-4 h-4" />;
    return <Clock className="w-4 h-4" />;
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <motion.div
        initial={false}
        animate={{ width: sidebarOpen ? 280 : 80 }}
        transition={{ duration: 0.3, ease: chatEasing }}
        className="bg-card border-r border-border flex flex-col"
      >
        <div className="p-6 flex items-center justify-between">
          {sidebarOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h1 className="text-lg font-bold">zuckies admin</h1>
            </motion.div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="ml-auto"
          >
            {sidebarOpen ? (
              <X className="w-4 h-4" />
            ) : (
              <Menu className="w-4 h-4" />
            )}
          </Button>
        </div>

        <div className="flex-1 px-4 space-y-4">
          <div className="space-y-2">
            <div className="px-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {sidebarOpen && "navigation"}
            </div>
            <Button
              variant={statusFilter === "all" ? "default" : "ghost"}
              size="sm"
              className="w-full justify-start"
              onClick={() => setStatusFilter("all")}
            >
              <Users className="w-4 h-4 mr-2" />
              {sidebarOpen && "all applicants"}
            </Button>
            <Button
              variant={statusFilter === "pending" ? "default" : "ghost"}
              size="sm"
              className="w-full justify-start"
              onClick={() => setStatusFilter("pending")}
            >
              <Clock className="w-4 h-4 mr-2" />
              {sidebarOpen && "pending"}
            </Button>
            <Button
              variant={statusFilter === "approved" ? "default" : "ghost"}
              size="sm"
              className="w-full justify-start"
              onClick={() => setStatusFilter("approved")}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {sidebarOpen && "approved"}
            </Button>
            <Button
              variant={statusFilter === "rejected" ? "default" : "ghost"}
              size="sm"
              className="w-full justify-start"
              onClick={() => setStatusFilter("rejected")}
            >
              <AlertCircle className="w-4 h-4 mr-2" />
              {sidebarOpen && "rejected"}
            </Button>
          </div>

          <div className="h-px bg-border" />

          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3 pt-2"
            >
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                stats
              </div>
              <div className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">total</span>
                  <span className="font-semibold">{stats.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">pending</span>
                  <span className="font-semibold">{stats.pending}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">accepted</span>
                  <span className="font-semibold">{stats.accepted}</span>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        <div className="p-4 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={onLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            {sidebarOpen && "logout"}
          </Button>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-card border-b border-border p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">applications dashboard</h2>
            <p className="text-muted-foreground text-sm mt-1">
              hey {adminName}, reviewing {filteredApplicants.length} of{" "}
              {applicants.length} applicants
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
            animate={{ width: assistantOpen ? "60%" : "100%" }}
            transition={{ duration: 0.3, ease: chatEasing }}
            className="border-r border-border flex flex-col overflow-hidden"
          >
            {/* Search Bar */}
            <div className="p-6 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="search by name, email, or session id..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Applications Table */}
            <div className="flex-1 overflow-y-auto">
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
                    <p className="text-muted-foreground">no applicants found</p>
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
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedApplicant?.session_id === applicant.session_id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">
                              {applicant.applicant_data.name}
                            </h3>
                            <div
                              className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                                applicant.applicant_data.application_status
                              )}`}
                            >
                              {getStatusIcon(
                                applicant.applicant_data.application_status
                              )}
                              {applicant.applicant_data.application_status}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {applicant.applicant_data.email}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {applicant.applicant_data.engineering_area} •{" "}
                            {applicant.applicant_data.skill_level}
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
            </div>
          </motion.div>

          {/* Assistant Panel */}
          <AnimatePresence>
            {assistantOpen && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3, ease: chatEasing }}
                className="w-2/5 flex flex-col bg-card border-l border-border"
              >
                {/* Selected Applicant Preview */}
                {selectedApplicant && (
                  <div className="p-6 border-b border-border">
                    <h3 className="font-semibold text-sm mb-3">
                      reviewing: {selectedApplicant.applicant_data.name}
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">area:</span>{" "}
                        <span className="font-medium">
                          {selectedApplicant.applicant_data.engineering_area}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">level:</span>{" "}
                        <span className="font-medium">
                          {selectedApplicant.applicant_data.skill_level}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">goals:</span>{" "}
                        <span className="font-medium line-clamp-2">
                          {selectedApplicant.applicant_data.career_goals}
                        </span>
                      </div>
                    </div>

                    {selectedApplicant.applicant_data.application_status ===
                      "pending" && (
                      <div className="flex gap-2 mt-4">
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
                  </div>
                )}

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {chatMessages.map((msg, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.3,
                        ease: chatEasing,
                        delay: idx * 0.05,
                      }}
                      className={`flex ${
                        msg.role === "admin" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-xs px-4 py-2 rounded-lg text-sm ${
                          msg.role === "admin"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {msg.content}
                      </div>
                    </motion.div>
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
                <div className="p-6 border-t border-border">
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
                      className="flex-1"
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
