"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Mail, ArrowLeft, KeyRound } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/reset-password`;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo }
      );

      if (resetError) {
        setError(resetError.message);
      } else {
        setSent(true);
      }
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

          {sent ? (
            <div>
              <div className="h-14 w-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-5">
                <Mail className="h-6 w-6 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Check your email</h2>
              <p className="text-sm text-slate-600 mb-2">
                If an account exists for <span className="font-mono font-semibold text-slate-900">{email.trim().toLowerCase()}</span>, we&apos;ve sent a password reset link.
              </p>
              <p className="text-sm text-slate-500 leading-relaxed mb-6">
                The link expires in 1 hour. Don&apos;t see it? Check your spam folder, then resend below.
              </p>
              <button
                onClick={() => { setSent(false); setEmail(email); }}
                className="w-full bg-white border border-slate-200 text-slate-700 py-2.5 rounded-lg font-semibold hover:bg-slate-50 transition-colors mb-3"
              >
                Resend Email
              </button>
              <Link
                href="/login"
                className="flex items-center justify-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-dark"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              <div className="h-14 w-14 rounded-full bg-brand-surface border border-brand/20 flex items-center justify-center mb-5">
                <KeyRound className="h-6 w-6 text-brand" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Reset your password</h2>
              <p className="text-sm text-slate-500 mb-6">
                Enter your email and we&apos;ll send you a link to reset your password.
              </p>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-5 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    className="w-full px-4 py-3 rounded-lg border border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:border-brand"
                    placeholder="admin@example.com"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full bg-brand text-white py-3 rounded-lg font-semibold hover:bg-brand-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? "Sending..." : "Send Reset Link"}
                </button>

                <Link
                  href="/login"
                  className="flex items-center justify-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-700 pt-2"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to Sign In
                </Link>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
