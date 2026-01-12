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
      // Test the secret by fetching applications
      const response = await fetch(
        `/api/admin/review?secret=${encodeURIComponent(secret)}`
      );

      if (!response.ok) {
        if (response.status === 401) {
          setError("invalid admin secret");
          return;
        }
        throw new Error("Authentication failed");
      }

      // Success - store secret and proceed
      localStorage.setItem("admin_secret", secret);
      toast.success("logged in successfully");
      onLogin(secret, adminName || "Admin");
    } catch (err) {
      console.error("Login error:", err);
      setError("couldn't verify secret. check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-card flex items-center justify-center px-4">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            x: [0, 100, 0],
            y: [0, 50, 0],
          }}
          transition={{ duration: 20, repeat: Infinity }}
          className="absolute top-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            x: [0, -100, 0],
            y: [0, -50, 0],
          }}
          transition={{ duration: 25, repeat: Infinity }}
          className="absolute bottom-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl"
        />
      </div>

      {/* Login Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: chatEasing }}
        className="relative z-10 w-full max-w-md"
      >
        <Card className="p-8 backdrop-blur-sm border-border/50">
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
