"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import type { DayOfWeek } from "@recreserve/shared";

const STEPS = ["Club Details", "First Court", "Booking Rules", "Done"];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface ClubForm {
  name: string;
  location: string;
}

interface CourtForm {
  name: string;
}

interface AvailabilityForm {
  enabled: boolean;
  open: string;
  close: string;
}

interface RulesForm {
  max_booking_duration_mins: number;
  advance_booking_days: number;
  cancellation_cutoff_hours: number;
  max_active_bookings_per_user: number;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [club, setClub] = useState<ClubForm>({ name: "", location: "" });
  const [court, setCourt] = useState<CourtForm>({ name: "" });
  const [availability, setAvailability] = useState<AvailabilityForm[]>(
    Array.from({ length: 7 }, () => ({ enabled: true, open: "08:00", close: "21:00" }))
  );
  const [stripeOnboardingUrl, setStripeOnboardingUrl] = useState("");

  const [rules, setRules] = useState<RulesForm>({
    max_booking_duration_mins: 60,
    advance_booking_days: 7,
    cancellation_cutoff_hours: 2,
    max_active_bookings_per_user: 3,
  });

  const canProceed = () => {
    if (step === 0) return club.name.trim().length > 0;
    if (step === 1) return court.name.trim().length > 0;
    if (step === 2) return true;
    return true;
  };

  const handleNext = async () => {
    if (step < 2) {
      setStep(step + 1);
      return;
    }

    if (step === 2) {
      await handleComplete();
    }
  };

  const handleComplete = async () => {
    setSaving(true);
    setError("");

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      // 1. Create club
      const { data: newClub, error: clubErr } = await supabase
        .from("clubs")
        .insert({
          name: club.name.trim(),
          location: club.location.trim() || null,
          subscription_status: "active",
        })
        .select("id")
        .single();

      if (clubErr) throw clubErr;

      // 2. Link admin to club
      await supabase
        .from("users")
        .update({ club_id: newClub.id })
        .eq("id", session.user.id);

      // 3. Create court
      const { data: newCourt, error: courtErr } = await supabase
        .from("courts")
        .insert({
          club_id: newClub.id,
          name: court.name.trim(),
          is_active: true,
        })
        .select("id")
        .single();

      if (courtErr) throw courtErr;

      // 4. Create availability
      const availRows = availability
        .map((a, idx) => {
          if (!a.enabled) return null;
          return {
            court_id: newCourt.id,
            day_of_week: idx as DayOfWeek,
            open_time: a.open,
            close_time: a.close,
          };
        })
        .filter(Boolean);

      if (availRows.length > 0) {
        const { error: availErr } = await supabase
          .from("court_availability")
          .insert(availRows);
        if (availErr) throw availErr;
      }

      // 5. Create booking rules
      const { error: rulesErr } = await supabase
        .from("booking_rules")
        .insert({
          club_id: newClub.id,
          ...rules,
        });

      if (rulesErr) throw rulesErr;

      // 6. Create membership for admin
      await supabase.from("memberships").insert({
        user_id: session.user.id,
        club_id: newClub.id,
        tier: "premium",
        start_date: new Date().toLocaleDateString("en-CA"),
        is_active: true,
      });

      // Kick off Stripe Connect onboarding
      try {
        const { data: stripeData, error: stripeErr } = await supabase.functions.invoke(
          "create-connect-account",
          {
            body: {
              club_id: newClub.id,
              email: session.user.email,
              return_url: `${window.location.origin}/stripe-return`,
              refresh_url: `${window.location.origin}/stripe-return?refresh=true`,
            },
          }
        );

        if (!stripeErr && stripeData?.url) {
          // Store the URL so the Done step can redirect
          setStripeOnboardingUrl(stripeData.url);
        }
      } catch (e) {
        // Non-fatal — club is created, they can set up Stripe later
        console.warn("Stripe Connect setup deferred:", e);
      }

      setStep(3);
    } catch (err) {
      console.error("Onboarding error:", err);
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const updateAvail = (idx: number, field: keyof AvailabilityForm, value: string | boolean) => {
    setAvailability((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, [field]: value } : a))
    );
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((label, idx) => (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                idx < step
                  ? "bg-green-500 text-white"
                  : idx === step
                  ? "bg-brand text-white"
                  : "bg-slate-200 text-slate-500"
              }`}
            >
              {idx < step ? "✓" : idx + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${idx <= step ? "text-slate-900" : "text-slate-400"}`}>
              {label}
            </span>
            {idx < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 ${idx < step ? "bg-green-500" : "bg-slate-200"}`} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Club Details */}
      {step === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-1">Set Up Your Club</h2>
          <p className="text-sm text-slate-500 mb-6">Tell us about your club</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Club Name *</label>
              <input
                type="text"
                value={club.name}
                onChange={(e) => setClub({ ...club, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                placeholder="Oakwood Tennis Club"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
              <input
                type="text"
                value={club.location}
                onChange={(e) => setClub({ ...club, location: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                placeholder="123 Main St, City, State"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 2: First Court */}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-1">Add Your First Court</h2>
          <p className="text-sm text-slate-500 mb-6">You can add more courts later</p>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Court Name *</label>
              <input
                type="text"
                value={court.name}
                onChange={(e) => setCourt({ ...court, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                placeholder="Court 1"
              />
            </div>
          </div>

          <h3 className="text-sm font-semibold text-slate-700 mb-3">Availability Hours</h3>
          <div className="space-y-2">
            {DAY_LABELS.map((label, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <button
                  onClick={() => updateAvail(idx, "enabled", !availability[idx].enabled)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${
                    availability[idx].enabled ? "bg-brand" : "bg-slate-300"
                  }`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    availability[idx].enabled ? "translate-x-4" : "translate-x-0"
                  }`} />
                </button>
                <span className="w-10 text-sm font-medium text-slate-600">{label}</span>
                {availability[idx].enabled ? (
                  <>
                    <input type="time" value={availability[idx].open} onChange={(e) => updateAvail(idx, "open", e.target.value)} className="px-2 py-1 rounded border border-slate-300 text-sm text-slate-900" />
                    <span className="text-slate-400 text-sm">–</span>
                    <input type="time" value={availability[idx].close} onChange={(e) => updateAvail(idx, "close", e.target.value)} className="px-2 py-1 rounded border border-slate-300 text-sm text-slate-900" />
                  </>
                ) : (
                  <span className="text-sm text-slate-400">Closed</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Booking Rules */}
      {step === 2 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-1">Booking Rules</h2>
          <p className="text-sm text-slate-500 mb-6">Set the rules for your club</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Max Duration (min)</label>
              <input type="number" min={15} step={15} value={rules.max_booking_duration_mins} onChange={(e) => setRules({ ...rules, max_booking_duration_mins: Number(e.target.value) })} className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Advance Booking (days)</label>
              <input type="number" min={1} value={rules.advance_booking_days} onChange={(e) => setRules({ ...rules, advance_booking_days: Number(e.target.value) })} className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cancellation Cutoff (hrs)</label>
              <input type="number" min={0} value={rules.cancellation_cutoff_hours} onChange={(e) => setRules({ ...rules, cancellation_cutoff_hours: Number(e.target.value) })} className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Max Active Bookings</label>
              <input type="number" min={1} value={rules.max_active_bookings_per_user} onChange={(e) => setRules({ ...rules, max_active_bookings_per_user: Number(e.target.value) })} className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30" />
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Done */}
      {step === 3 && (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✓</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Club Created!</h2>
          <p className="text-slate-500 mb-6">
            {stripeOnboardingUrl
              ? "One last step — connect your Stripe account so you can accept payments from players."
              : "Your club is ready. You can add more courts and customize settings from the dashboard."}
          </p>
          {stripeOnboardingUrl ? (
            <div className="space-y-3">
              <a
                href={stripeOnboardingUrl}
                className="inline-block px-6 py-3 bg-brand text-white font-medium rounded-lg hover:bg-brand-dark transition-colors"
              >
                Set Up Stripe Payments
              </a>
              <button
                onClick={() => router.replace("/")}
                className="block mx-auto text-sm text-slate-500 hover:text-slate-700"
              >
                Skip for now
              </button>
            </div>
          ) : (
            <button
              onClick={() => router.replace("/")}
              className="px-6 py-3 bg-brand text-white font-medium rounded-lg hover:bg-brand-dark transition-colors"
            >
              Go to Dashboard
            </button>
          )}
        </div>
      )}

      {/* Navigation */}
      {step < 3 && (
        <div className="flex justify-between mt-6">
          {step > 0 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="px-5 py-2.5 text-slate-600 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50"
            >
              Back
            </button>
          ) : (
            <div />
          )}
          <button
            onClick={handleNext}
            disabled={!canProceed() || saving}
            className="px-6 py-2.5 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark disabled:opacity-50 transition-colors"
          >
            {saving ? "Setting up..." : step === 2 ? "Complete Setup" : "Next"}
          </button>
        </div>
      )}
    </div>
  );
}
