"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";

interface Tier {
  id: string;
  name: string;
  is_paid: boolean;
  is_default: boolean;
  monthly_price_cents: number;
}

interface Props {
  clubId: string;
}

export function MembershipRequirementsCard({ clubId }: Props) {
  const [loading, setLoading] = useState(true);
  const [requiresPaid, setRequiresPaid] = useState(false);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [defaultTierId, setDefaultTierId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  const [initial, setInitial] = useState<{ requiresPaid: boolean; defaultTierId: string }>({
    requiresPaid: false,
    defaultTierId: "",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();

      const [clubRes, tiersRes] = await Promise.all([
        supabase
          .from("clubs")
          .select("requires_paid_membership")
          .eq("id", clubId)
          .single(),
        supabase
          .from("membership_tiers")
          .select("id, name, is_paid, is_default, monthly_price_cents")
          .eq("club_id", clubId)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true }),
      ]);

      if (clubRes.error) throw clubRes.error;
      if (tiersRes.error) throw tiersRes.error;

      const clubData = clubRes.data as { requires_paid_membership: boolean | null };
      const tierData = (tiersRes.data ?? []) as Tier[];

      const currentDefault = tierData.find((t) => t.is_default);
      const nextRequiresPaid = !!clubData.requires_paid_membership;
      const nextDefaultId = currentDefault?.id ?? "";

      setRequiresPaid(nextRequiresPaid);
      setDefaultTierId(nextDefaultId);
      setTiers(tierData);
      setInitial({ requiresPaid: nextRequiresPaid, defaultTierId: nextDefaultId });
    } catch (err) {
      console.error("Error loading membership requirements:", err);
      setSaveError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const freeTiers = tiers.filter((t) => !t.is_paid);
  const hasFreeTiers = freeTiers.length > 0;
  const defaultTier = tiers.find((t) => t.id === defaultTierId);

  const isDirty =
    requiresPaid !== initial.requiresPaid || defaultTierId !== initial.defaultTierId;

  const warnMissingDefault = !requiresPaid && !defaultTierId;

  const handleSave = async () => {
    if (!isDirty) return;
    setSaving(true);
    setSaveError("");
    setSaved(false);

    try {
      const supabase = createClient();

      // 1. Update club requirement
      if (requiresPaid !== initial.requiresPaid) {
        const { error } = await supabase
          .from("clubs")
          .update({ requires_paid_membership: requiresPaid })
          .eq("id", clubId);
        if (error) throw error;
      }

      // 2. Update default tier (two-step: clear existing, set new)
      if (defaultTierId !== initial.defaultTierId) {
        // Clear all defaults for this club first
        const { error: clearError } = await supabase
          .from("membership_tiers")
          .update({ is_default: false })
          .eq("club_id", clubId)
          .eq("is_default", true);
        if (clearError) throw clearError;

        // Set new default if one was chosen
        if (defaultTierId) {
          const { error: setError } = await supabase
            .from("membership_tiers")
            .update({ is_default: true })
            .eq("id", defaultTierId);
          if (setError) throw setError;
        }
      }

      setInitial({ requiresPaid, defaultTierId });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      // Refresh tier list so is_default flags are current
      fetchData();
    } catch (err) {
      console.error("Error saving membership requirements:", err);
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse">
        <div className="h-5 w-56 bg-slate-200 rounded mb-4" />
        <div className="space-y-3">
          <div className="h-10 bg-slate-100 rounded-lg" />
          <div className="h-10 bg-slate-100 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-1">Membership Requirements</h2>
      <p className="text-sm text-slate-500 mb-5">
        Control how new members join your club
      </p>

      <div className="space-y-5">
        {/* Require paid membership toggle */}
        <div className="flex items-start justify-between gap-4 py-2">
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-900">
              Require paid membership to join
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              When on, new members must pick a paid tier before joining.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRequiresPaid(!requiresPaid)}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 mt-1 ${
              requiresPaid ? "bg-brand" : "bg-slate-300"
            }`}
            aria-pressed={requiresPaid}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                requiresPaid ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Default tier dropdown */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Default tier for new members{requiresPaid ? " (optional)" : " *"}
          </label>
          <select
            value={defaultTierId}
            onChange={(e) => setDefaultTierId(e.target.value)}
            disabled={!hasFreeTiers}
            className={`w-full px-3.5 py-2.5 rounded-lg border text-sm text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand ${
              warnMissingDefault ? "border-amber-400" : "border-slate-300"
            } ${!hasFreeTiers ? "bg-slate-100 text-slate-400 cursor-not-allowed" : ""}`}
          >
            <option value="">— None —</option>
            {freeTiers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {!hasFreeTiers && (
            <p className="text-xs text-slate-500 mt-1.5">
              Create a free membership tier first, then return here to set it as default.
            </p>
          )}
          {warnMissingDefault && hasFreeTiers && (
            <p className="text-xs text-warning mt-1.5">
              Warning: no default tier set — new members will join without any membership.
            </p>
          )}
        </div>

        {/* Summary */}
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
          <p className="text-xs uppercase tracking-wide font-semibold text-slate-500 mb-1.5">
            Summary
          </p>
          <p className="text-sm text-slate-700">
            {requiresPaid ? (
              defaultTier ? (
                <>
                  New members joining this club must choose a paid tier. If they
                  skip, they&apos;ll be placed on <strong>{defaultTier.name}</strong> until they subscribe.
                </>
              ) : (
                <>
                  New members joining this club must choose a paid tier before they can participate.
                </>
              )
            ) : defaultTier ? (
              <>
                New members joining this club will automatically be assigned to{" "}
                <strong>{defaultTier.name}</strong> unless they choose a paid tier.
              </>
            ) : (
              <>
                New members will join without any membership tier until one is assigned manually.
              </>
            )}
          </p>
        </div>

        {/* Save */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="px-5 py-2.5 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {saving && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            )}
            {saving ? "Saving..." : "Save Requirements"}
          </button>
          {saved && (
            <span className="flex items-center gap-1 text-sm font-medium text-success">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Saved
            </span>
          )}
          {saveError && <span className="text-sm text-error">{saveError}</span>}
        </div>
      </div>
    </div>
  );
}
