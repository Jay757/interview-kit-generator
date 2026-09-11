"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { ArrowLeft, Lock, Mail, ShieldAlert, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { ThemeToggle } from "../../components/ui/ThemeToggle";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { register, user, loading: authLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/kits");
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("All fields are required.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    const result = await register(email, password);

    if (result.success) {
      router.push("/kits");
    } else {
      setError(result.error || "Registration failed.");
      setSubmitting(false);
    }
  };

  return (
    <div
      className={cn(
        "min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors duration-200 relative bg-grid-architectural",
        theme === "dark" ? "bg-[#08090d] text-slate-100" : "bg-slate-50 text-slate-900"
      )}
    >
      {/* Top action row */}
      <div className="absolute top-6 left-6 right-6 flex items-center justify-between max-w-7xl mx-auto">
        <Link
          href="/"
          className={cn(
            "inline-flex items-center gap-1.5 text-xs font-mono transition-colors",
            theme === "dark" ? "text-zinc-400 hover:text-white" : "text-slate-600 hover:text-slate-900"
          )}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Home</span>
        </Link>
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4 mt-6">
        <div className="flex items-center space-x-3 mb-3">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-black text-xs shadow-md shadow-amber-500/20">
            TR
          </div>
          <span className="font-bold text-lg tracking-tight">TRAO PREP</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Create your account</h2>
        <p
          className={cn(
            "mt-1.5 text-xs leading-relaxed",
            theme === "dark" ? "text-zinc-400" : "text-slate-600"
          )}
        >
          Generate personalized study schedules, question banks, and active flashcards from real
          company intelligence.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div
          className={cn(
            "py-8 px-6 sm:px-8 shadow-2xl border rounded-2xl transition-colors",
            theme === "dark"
              ? "bg-[#0e111a] border-white/[0.08]"
              : "bg-white border-slate-200 shadow-slate-200/50"
          )}
        >
          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start space-x-2.5">
              <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5"
              >
                Work / Personal Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="engineer@company.com"
                  className={cn(
                    "block w-full pl-9 pr-3 py-2.5 rounded-lg text-sm transition font-sans focus:outline-none focus:ring-1 focus:ring-amber-500/50",
                    theme === "dark"
                      ? "bg-[#08090d] border border-white/[0.1] text-white placeholder-zinc-600 focus:border-amber-500/60"
                      : "bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-500"
                  )}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5"
              >
                Password (min. 8 characters)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className={cn(
                    "block w-full pl-9 pr-3 py-2.5 rounded-lg text-sm transition font-sans focus:outline-none focus:ring-1 focus:ring-amber-500/50",
                    theme === "dark"
                      ? "bg-[#08090d] border border-white/[0.1] text-white placeholder-zinc-600 focus:border-amber-500/60"
                      : "bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-500"
                  )}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5"
              >
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className={cn(
                    "block w-full pl-9 pr-3 py-2.5 rounded-lg text-sm transition font-sans focus:outline-none focus:ring-1 focus:ring-amber-500/50",
                    theme === "dark"
                      ? "bg-[#08090d] border border-white/[0.1] text-white placeholder-zinc-600 focus:border-amber-500/60"
                      : "bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-500"
                  )}
                />
              </div>
            </div>

            <div className="space-y-1.5 text-[11px] font-mono text-zinc-500">
              <div className="flex items-center space-x-1.5">
                <CheckCircle2
                  className={cn(
                    "w-3.5 h-3.5",
                    password.length >= 8 ? "text-emerald-400" : "text-zinc-600"
                  )}
                />
                <span>At least 8 characters long</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <CheckCircle2
                  className={cn(
                    "w-3.5 h-3.5",
                    password && password === confirmPassword ? "text-emerald-400" : "text-zinc-600"
                  )}
                />
                <span>Passwords match exactly</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs font-mono uppercase tracking-wider transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-amber-500/20 active:scale-[0.98]"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          <div
            className={cn(
              "mt-6 pt-6 border-t text-center",
              theme === "dark" ? "border-white/[0.06]" : "border-slate-200"
            )}
          >
            <p className="text-xs text-zinc-400">
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-amber-500 hover:text-amber-400 font-semibold underline underline-offset-4 ml-1"
              >
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
