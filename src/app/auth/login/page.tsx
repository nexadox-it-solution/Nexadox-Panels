"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Eye, EyeOff, Loader, AlertCircle,
  Calendar, Users, Shield, Stethoscope, Clock
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function getSupabase() {
  return createClient();
}

const ROLE_ROUTES: Record<string, string> = {
  admin:     "/admin",
  doctor:    "/doctor",
  agent:     "/agent",
  attendant: "/attendant",
  patient:   "/patient",
};

export default function LoginPage() {
  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [showPass,    setShowPass]    = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data: authData, error: authErr } = await getSupabase().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authErr) throw authErr;

      const authId = authData.user.id;

      // SINGLE SOURCE OF TRUTH: profiles table only
      const { data: profile, error: profileErr } = await getSupabase()
        .from("profiles")
        .select("role, status")
        .eq("id", authId)
        .single();

      if (profileErr || !profile) {
        throw new Error("User profile not found. Please contact support.");
      }

      if (profile.status === "inactive" || profile.status === "suspended") {
        throw new Error("Your account has been deactivated. Please contact admin.");
      }

      const route = ROLE_ROUTES[profile.role] ?? "/admin";
      window.location.replace(route);
    } catch (err: any) {
      setError(err?.message || "Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: Calendar, title: "Smart Scheduling", desc: "AI-powered appointment booking with real-time availability" },
    { icon: Users, title: "Multi-Role Panels", desc: "Admin, Doctor, Agent & Attendant dashboards" },
    { icon: Shield, title: "Secure & Compliant", desc: "End-to-end encrypted data with role-based access" },
    { icon: Clock, title: "Live Queue System", desc: "Real-time token management & patient tracking" },
  ];

  return (
    <div className="min-h-screen flex">
      {/* -- LEFT SIDE: Branding & Info -- */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800">
        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/5 rounded-full" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] bg-white/5 rounded-full" />
        <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-white/5 rounded-full" />

        <div className="relative z-10 flex flex-col justify-between w-full p-12">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="bg-white/15 backdrop-blur-sm p-2.5 rounded-xl">
              <img src="/Nexadox.png" alt="Nexadox" className="h-10 w-10 object-contain" />
            </div>
            <span className="text-3xl font-bold text-white tracking-tight">Nexadox</span>
          </div>

          {/* Center content */}
          <div className="space-y-8">
            <div>
              <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
                Doctor Appointment<br />
                Booking & Clinic<br />
                Management
              </h1>
              <p className="mt-4 text-lg text-brand-100/80 max-w-md">
                A unified platform for managing appointments, patients, queues, and commissions � all in one place.
              </p>
            </div>

            {/* Feature cards */}
            <div className="grid grid-cols-2 gap-4">
              {features.map((f, i) => (
                <div
                  key={i}
                  className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl p-4 hover:bg-white/15 transition-colors"
                >
                  <f.icon className="h-6 w-6 text-brand-200 mb-2" />
                  <h3 className="text-sm font-semibold text-white">{f.title}</h3>
                  <p className="text-xs text-brand-100/70 mt-1 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom stats */}
          <div className="flex items-center gap-8 pt-4">
            <div>
              <p className="text-2xl font-bold text-white">4</p>
              <p className="text-xs text-brand-200/70">Role Panels</p>
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div>
              <p className="text-2xl font-bold text-white">24/7</p>
              <p className="text-xs text-brand-200/70">Availability</p>
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div>
              <p className="text-2xl font-bold text-white">100%</p>
              <p className="text-xs text-brand-200/70">Secure</p>
            </div>
          </div>
        </div>
      </div>

      {/* -- RIGHT SIDE: Login Form -- */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-slate-50 p-6 sm:p-8">
        <div className="w-full max-w-md">
          {/* Mobile logo (hidden on desktop) */}
          <div className="flex items-center justify-center gap-3 mb-8 lg:hidden">
            <div className="bg-gradient-to-br from-brand-600 to-brand-700 p-2.5 rounded-xl">
              <img src="/Nexadox.png" alt="Nexadox" className="h-9 w-9 object-contain" />
            </div>
            <span className="text-3xl font-bold bg-gradient-to-r from-brand-600 to-brand-700 bg-clip-text text-transparent">
              Nexadox
            </span>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-brand-600 to-brand-700 rounded-2xl mb-4 shadow-lg shadow-brand-200 overflow-hidden">
                <img src="/Nexadox.png" alt="Nexadox" className="h-10 w-10 object-contain" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">Welcome Back</h2>
              <p className="text-sm text-slate-500 mt-1">Sign in to your dashboard</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-slate-700 font-semibold text-sm">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-12 rounded-xl text-sm font-medium bg-slate-50 border-slate-200 focus:bg-white focus:border-brand-400 focus:ring-brand-400 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-slate-700 font-semibold text-sm">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPass ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="h-12 rounded-xl text-sm font-medium pr-12 bg-slate-50 border-slate-200 focus:bg-white focus:border-brand-400 focus:ring-brand-400 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-700 hover:to-brand-800 text-white font-semibold text-sm rounded-xl gap-2 shadow-lg shadow-brand-200/50 transition-all hover:shadow-brand-300/50"
              >
                {loading ? (
                  <><Loader className="h-4 w-4 animate-spin" /> Signing in�</>
                ) : (
                  "Sign In"
                )}
              </Button>

              <p className="text-center text-xs text-slate-400 pt-1">
                Trouble logging in? Contact your administrator.
              </p>
            </form>


          </div>

          <p className="text-center text-xs text-slate-400 mt-6">
            &copy; 2026 Nexadox. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}

