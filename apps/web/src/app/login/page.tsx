"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import { ArrowLeft, Lock, Mail, ShieldAlert, ArrowRight, Loader2 } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { login, user, loading: authLoading } = useAuth();
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
      setError("Please fill in both email and password.");
      return;
    }

    setSubmitting(true);
    const result = await login(email, password);

    if (result.success) {
      router.push("/kits");
    } else {
      setError(result.error || "Authentication failed. Check your credentials.");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-grid-architectural">
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        <Link
          href="/"
          className="inline-flex items-center space-x-1.5 text-xs font-mono text-zinc-400 hover:text-white transition mb-8"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Architecture Overview</span>
        </Link>

        <div className="flex items-center space-x-3 mb-2">
          <div className="h-8 w-8 rounded bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-mono text-sm font-bold">
            TR
          </div>
          <span className="font-semibold text-lg tracking-tight text-white">TRAO</span>
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Sign in to your account</h2>
        <p className="mt-1 text-xs text-zinc-400">
          Access your personal interview preparation kits and practice sessions.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-[#0e111a] py-8 px-6 shadow-2xl border border-white/[0.08] rounded-xl sm:px-8">
          {error && (
            <div className="mb-6 p-3.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start space-x-2.5">
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
                  className="block w-full pl-9 pr-3 py-2 bg-[#090a0f] border border-white/[0.1] rounded text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/50 transition font-sans"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-mono uppercase tracking-wider text-zinc-400 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-9 pr-3 py-2 bg-[#090a0f] border border-white/[0.1] rounded text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/50 transition font-sans"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded bg-amber-500 hover:bg-amber-400 text-black font-medium text-xs font-mono uppercase tracking-wider transition disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(245,158,11,0.2)]"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-zinc-800/80 text-center">
            <p className="text-xs text-zinc-400">
              Need an account?{" "}
              <Link
                href="/register"
                className="text-amber-400 hover:text-amber-300 font-medium underline underline-offset-4"
              >
                Register here
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
