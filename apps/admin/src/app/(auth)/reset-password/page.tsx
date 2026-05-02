"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, AlertCircle, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [success, setSuccess] = useState(false);

  // The Supabase JS client auto-detects the URL hash params on mount
  // (detectSessionInUrl is true on the web by default) and creates a
  // PASSWORD_RECOVERY session. We just listen for it.
  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      setHasSession(!!session);
    };

    // Initial check (handles direct visits with already-active session)
    checkSession();

    // Watch for the recovery session arriving via URL hash detection
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setHasSession(true);
      } else if (event === "SIGNED_OUT") {
        setHasSession(false);
      }
    });

    // Give the URL detection a moment, then finalize
    const t = setTimeout(checkSession, 800);

    return () => {
      mounted = false;
      subscription?.subscription?.unsubscribe?.();
      clearTimeout(t);
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setSuccess(true);
      // Sign out and redirect to login after a brief moment
      setTimeout(async () => {
        await supabase.auth.signOut();
        router.replace("/login");
      }, 1500);
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 flex-col justify-center items-center px-12">
        <h1 className="text-4xl font-bold text-white mb-4">RecReserve</h1>
        <p className="text-slate-400 text-lg text-center">
          Court reservation management for tennis and pickleball clubs
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8">
            <h1 className="text-3xl font-bold text-slate-900 text-center">RecReserve</h1>
          </div>

          {hasSession === null && (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-brand" />
            </div>
          )}

          {hasSession === false && (
            <div>
              <div className="h-14 w-14 rounded-full bg-red-50 border border-red-200 flex items-center justify-center mb-5">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Link expired</h2>
              <p className="text-sm text-slate-500 mb-6">
                This password reset link is invalid or has expired. Request a new one below.
              </p>
              <Link
                href="/forgot-password"
                className="block w-full text-center bg-brand text-white py-3 rounded-lg font-semibold hover:bg-brand-dark transition-colors mb-3"
              >
                Request New Link
              </Link>
              <Link
                href="/login"
                className="flex items-center justify-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Sign In
              </Link>
            </div>
          )}

          {hasSession === true && success && (
            <div>
              <div className="h-14 w-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-5">
                <Lock className="h-6 w-6 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Password updated</h2>
              <p className="text-sm text-slate-500">Redirecting you to sign in…</p>
            </div>
          )}

          {hasSession === true && !success && (
            <>
              <div className="h-14 w-14 rounded-full bg-brand-surface border border-brand/20 flex items-center justify-center mb-5">
                <Lock className="h-6 w-6 text-brand" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Set new password</h2>
              <p className="text-sm text-slate-500 mb-6">Choose a new password for your account.</p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-5 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
                    New password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={show ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoFocus
                      minLength={8}
                      className="w-full pl-4 pr-11 py-3 rounded-lg border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:border-brand"
                      placeholder="At least 8 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShow(!show)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      aria-label={show ? "Hide password" : "Show password"}
                    >
                      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirm" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Confirm password
                  </label>
                  <input
                    id="confirm"
                    type={show ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={8}
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:border-brand"
                    placeholder="Re-enter password"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !password || !confirm}
                  className="w-full bg-brand text-white py-3 rounded-lg font-semibold hover:bg-brand-dark disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? "Updating..." : "Update Password"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
