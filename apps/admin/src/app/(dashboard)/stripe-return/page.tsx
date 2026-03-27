"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { useAdminClub } from "@/lib/useAdminClub";

export default function StripeReturnPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { admin, loading: adminLoading } = useAdminClub();
  const [status, setStatus] = useState<"loading" | "complete" | "pending" | "error">("loading");
  const isRefresh = searchParams.get("refresh") === "true";

  useEffect(() => {
    if (adminLoading || !admin?.clubId) return;

    const checkStatus = async () => {
      if (isRefresh) {
        // User clicked refresh / link expired — re-generate onboarding link
        setStatus("pending");
        return;
      }

      try {
        const supabase = createClient();
        const { data: club } = await supabase
          .from("clubs")
          .select("stripe_onboarding_complete")
          .eq("id", admin.clubId)
          .single();

        if (club?.stripe_onboarding_complete) {
          setStatus("complete");
        } else {
          setStatus("pending");
        }
      } catch {
        setStatus("error");
      }
    };

    checkStatus();
  }, [admin?.clubId, adminLoading, isRefresh]);

  const handleRetryOnboarding = async () => {
    if (!admin) return;
    setStatus("loading");

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("create-connect-account", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          club_id: admin.clubId,
          email: session.user.email,
          return_url: `${window.location.origin}/stripe-return`,
          refresh_url: `${window.location.origin}/stripe-return?refresh=true`,
        },
      });

      if (error) throw error;
      window.location.href = data.url;
    } catch {
      setStatus("error");
    }
  };

  if (status === "loading" || adminLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-600" />
      </div>
    );
  }

  if (status === "complete") {
    return (
      <div className="max-w-lg mx-auto mt-20 text-center">
        <div className="bg-white rounded-xl border border-slate-200 p-10">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">You&apos;re All Set!</h2>
          <p className="text-slate-500 mb-6">
            Your Stripe account is connected and ready to accept payments from players.
          </p>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="max-w-lg mx-auto mt-20 text-center">
        <div className="bg-white rounded-xl border border-slate-200 p-10">
          <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Almost There</h2>
          <p className="text-slate-500 mb-6">
            Your Stripe account setup isn&apos;t complete yet. Please finish the onboarding process to start accepting payments.
          </p>
          <button
            onClick={handleRetryOnboarding}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Continue Stripe Setup
          </button>
          <button
            onClick={() => router.push("/")}
            className="block mx-auto mt-3 text-sm text-slate-500 hover:text-slate-700"
          >
            Skip for now
          </button>
        </div>
      </div>
    );
  }

  // error
  return (
    <div className="max-w-lg mx-auto mt-20 text-center">
      <div className="bg-white rounded-xl border border-slate-200 p-10">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Something Went Wrong</h2>
        <p className="text-slate-500 mb-6">
          We couldn&apos;t verify your Stripe account status. Please try again.
        </p>
        <button
          onClick={handleRetryOnboarding}
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Retry Stripe Setup
        </button>
        <button
          onClick={() => router.push("/")}
          className="block mx-auto mt-3 text-sm text-slate-500 hover:text-slate-700"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
