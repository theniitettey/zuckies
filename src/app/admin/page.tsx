"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminLogin from "@/components/admin-login";
import AdminInterface from "@/components/admin-interface";

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminName, setAdminName] = useState("Admin");
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    // Check if already authenticated
    const storedToken = localStorage.getItem("admin_token");
    if (storedToken) {
      setIsAuthenticated(true);
      const storedName = localStorage.getItem("admin_name");
      if (storedName) setAdminName(storedName);
    }
  }, []);

  if (!mounted) return null;

  function handleLogin(token: string, name: string) {
    localStorage.setItem("admin_token", token);
    localStorage.setItem("admin_name", name);
    setAdminName(name);
    setIsAuthenticated(true);
  }

  function handleLogout() {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_name");
    setIsAuthenticated(false);
    setAdminName("Admin");
  }

  return (
    <>
      {isAuthenticated ? (
        <AdminInterface onLogout={handleLogout} adminName={adminName} />
      ) : (
        <AdminLogin onLogin={handleLogin} />
      )}
    </>
  );
}
