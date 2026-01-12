"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Lock, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface AdminLoginProps {
  onLogin: (secret: string, adminName: string) => void;
}

const chatEasing: [number, number, number, number] = [0.16, 1, 0.3, 1];

export default function AdminLogin({ onLogin }: AdminLoginProps) {
  const [secret, setSecret] = useState("");
  const [adminName, setAdminName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!secret.trim()) {
      setError("admin secret is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Get token from admin secret
      const response = await fetch("/api/admin/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError("invalid admin secret");
          return;
        }
        throw new Error("Authentication failed");
      }

      const { token } = await response.json();

      // Store token (not secret)
      localStorage.setItem("admin_token", token);
      toast.success("logged in successfully");
      onLogin(token, adminName || "Admin");
    } catch (err) {
      console.error("Login error:", err);
      setError("couldn't verify secret. check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 relative overflow-hidden">
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

      {/* Login Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: chatEasing }}
        className="relative z-10 w-full max-w-md"
      >
        <Card className="liquid-glass p-8 backdrop-blur-xl border-white/10">
          <div className="flex items-center justify-center mb-8">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              className="p-3 bg-primary/10 rounded-lg"
            >
              <Lock className="w-6 h-6 text-primary" />
            </motion.div>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold">admin access</h1>
            <p className="text-muted-foreground text-sm mt-2">
              welcome back. let's review some applications.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {/* Admin Name (Optional) */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                your name (optional)
              </label>
              <Input
                placeholder="e.g., michael"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                disabled={loading}
                className="lowercase"
              />
            </div>

            {/* Admin Secret */}
            <div className="space-y-2">
              <label className="text-sm font-medium">admin secret</label>
              <Input
                type="password"
                placeholder="enter your admin secret..."
                value={secret}
                onChange={(e) => {
                  setSecret(e.target.value);
                  setError("");
                }}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                this is used to verify your admin privileges
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg"
              >
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </motion.div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading || !secret.trim()}
              className="w-full"
              size="lg"
            >
              {loading ? "verifying..." : "enter admin dashboard"}
            </Button>

            {/* Help Text */}
            <div className="text-center text-xs text-muted-foreground">
              <p>
                need help?{" "}
                <a
                  href="https://tiktok.com/@okponglo_zuck"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  reach out to michael
                </a>
              </p>
            </div>
          </form>
        </Card>

        {/* Fun footer message */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center text-xs text-muted-foreground mt-6"
        >
          the admin dashboard. where real applications meet real feedback.
        </motion.p>
      </motion.div>
    </div>
  );
}
