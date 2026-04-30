"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAdminClub } from "@/lib/useAdminClub";
import {
  PageHeader,
  Card,
  Badge,
  Button,
  Modal,
  FormInput,
  FormSelect,
  FormTextarea,
  EmptyState,
  SkeletonCard,
  StatCard,
} from "@/components/ui";

type RewardType = "discount_percent" | "free_booking" | "bonus_credit";

interface MilestoneReward {
  id: string;
  club_id: string;
  milestone: number;
  reward_type: RewardType;
  reward_value: number;
  title: string;
  description: string | null;
  expires_days: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface RewardForm {
  milestone_choice: string; // "4" | "8" | "12" | "26" | "52" | "custom"
  milestone_custom: string;
  reward_type: RewardType;
  percent_value: string; // for discount_percent
  credit_dollars: string; // for bonus_credit
  title: string;
  description: string;
  expires_choice: string; // "30" | "60" | "90" | "180" | "365" | "never"
  is_active: boolean;
}

interface RewardCardStats {
  earned: number;
  redeemed: number;
}

interface AdoptionStats {
  totalDefined: number;
  grantedThisMonth: number;
  redeemedThisMonth: number;
}

const PRESET_MILESTONES: { value: number; label: string }[] = [
  { value: 4, label: "4-Week Streak" },
  { value: 8, label: "8-Week Streak" },
  { value: 12, label: "12-Week Streak" },
  { value: 26, label: "6-Month Streak" },
  { value: 52, label: "1-Year Streak" },
];

const PRESET_SET = new Set(PRESET_MILESTONES.map((m) => m.value));

const EXPIRES_OPTIONS = [
  { value: "30", label: "30 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" },
  { value: "180", label: "6 months" },
  { value: "365", label: "1 year" },
  { value: "never", label: "Never expires" },
];

const REWARD_TYPE_OPTIONS: { value: RewardType; label: string; blurb: string; placeholder: string }[] = [
  {
    value: "discount_percent",
    label: "Discount Percent",
    blurb: "A % off their next court booking",
    placeholder: "10% off next booking",
  },
  {
    value: "free_booking",
    label: "Free Booking",
    blurb: "One complimentary court booking",
    placeholder: "One free court booking",
  },
  {
    value: "bonus_credit",
    label: "Bonus Credit",
    blurb: "Dollar credit applied to their account",
    placeholder: "$5 credit on your account",
  },
];

const emptyForm: RewardForm = {
  milestone_choice: "4",
  milestone_custom: "",
  reward_type: "discount_percent",
  percent_value: "10",
  credit_dollars: "5.00",
  title: "",
  description: "",
  expires_choice: "60",
  is_active: true,
};

function dollarsToCents(dollars: string): number {
  const n = parseFloat(dollars);
  if (isNaN(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function centsToDollars(cents: number): string {
  if (!cents || cents <= 0) return "";
  return (cents / 100).toFixed(2);
}

function formatRewardValue(r: Pick<MilestoneReward, "reward_type" | "reward_value">): string {
  if (r.reward_type === "discount_percent") return `${r.reward_value}% off`;
  if (r.reward_type === "free_booking") return "Free booking";
  if (r.reward_type === "bonus_credit") {
    const whole = Math.floor(r.reward_value / 100);
    const fraction = r.reward_value % 100;
    return fraction === 0 ? `$${whole} credit` : `$${(r.reward_value / 100).toFixed(2)} credit`;
  }
  return "";
}

function formatExpiration(days: number | null): string {
  if (days == null) return "Never expires";
  if (days === 30) return "Expires 30 days after earning";
  if (days === 60) return "Expires 60 days after earning";
  if (days === 90) return "Expires 90 days after earning";
  if (days === 180) return "Expires 6 months after earning";
  if (days === 365) return "Expires 1 year after earning";
  return `Expires ${days} days after earning`;
}

function milestoneLabel(m: number): string {
  const preset = PRESET_MILESTONES.find((p) => p.value === m);
  return preset ? preset.label : `${m}-Week Streak`;
}

export default function RewardsProgramPage() {
  const { admin, loading: adminLoading } = useAdminClub();
  const [rewards, setRewards] = useState<MilestoneReward[]>([]);
  const [statsByReward, setStatsByReward] = useState<Record<string, RewardCardStats>>({});
  const [adoption, setAdoption] = useState<AdoptionStats>({
    totalDefined: 0,
    grantedThisMonth: 0,
    redeemedThisMonth: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [toastVariant, setToastVariant] = useState<"success" | "error">("success");

  // Form / modal state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<RewardForm>(emptyForm);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchRewards = useCallback(async (clubId: string) => {
    try {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from("milestone_rewards")
        .select("*")
        .eq("club_id", clubId)
        .order("milestone", { ascending: true })
        .order("created_at", { ascending: true });

      if (fetchError) throw fetchError;
      const list = (data ?? []) as MilestoneReward[];
      setRewards(list);

      // Per-reward earned / redeemed stats (batched)
      const statsEntries = await Promise.all(
        list.map(async (r) => {
          const [earnedRes, redeemedRes] = await Promise.all([
            supabase
              .from("player_rewards")
              .select("*", { count: "exact", head: true })
              .eq("milestone_reward_id", r.id),
            supabase
              .from("player_rewards")
              .select("*", { count: "exact", head: true })
              .eq("milestone_reward_id", r.id)
              .not("redeemed_at", "is", null),
          ]);
          return [r.id, { earned: earnedRes.count ?? 0, redeemed: redeemedRes.count ?? 0 }] as const;
        })
      );
      setStatsByReward(Object.fromEntries(statsEntries));
    } catch (err) {
      console.error("Error fetching rewards:", err);
      setError("Failed to load rewards");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAdoption = useCallback(async (clubId: string) => {
    try {
      const supabase = createClient();
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [definedRes, grantedRes, redeemedRes] = await Promise.all([
        supabase
          .from("milestone_rewards")
          .select("*", { count: "exact", head: true })
          .eq("club_id", clubId)
          .eq("is_active", true),
        supabase
          .from("player_rewards")
          .select("*", { count: "exact", head: true })
          .eq("club_id", clubId)
          .gte("granted_at", monthStart),
        supabase
          .from("player_rewards")
          .select("*", { count: "exact", head: true })
          .eq("club_id", clubId)
          .gte("redeemed_at", monthStart),
      ]);

      setAdoption({
        totalDefined: definedRes.count ?? 0,
        grantedThisMonth: grantedRes.count ?? 0,
        redeemedThisMonth: redeemedRes.count ?? 0,
      });
    } catch (err) {
      console.error("Error fetching adoption stats:", err);
    }
  }, []);

  useEffect(() => {
    if (admin?.clubId) {
      fetchRewards(admin.clubId);
      fetchAdoption(admin.clubId);
    }
  }, [admin?.clubId, fetchRewards, fetchAdoption]);

  const showToast = (message: string, variant: "success" | "error" = "success") => {
    setToast(message);
    setToastVariant(variant);
    setTimeout(() => setToast(""), 3500);
  };

  const openAddForm = (milestone?: number) => {
    const preset = milestone != null && PRESET_SET.has(milestone);
    setForm({
      ...emptyForm,
      milestone_choice: preset ? String(milestone) : milestone != null ? "custom" : "4",
      milestone_custom: preset ? "" : milestone != null ? String(milestone) : "",
    });
    setEditingId(null);
    setShowForm(true);
    setError("");
  };

  const openEditForm = (r: MilestoneReward) => {
    const preset = PRESET_SET.has(r.milestone);
    let expiresChoice = "never";
    if (r.expires_days != null) {
      const known = ["30", "60", "90", "180", "365"];
      expiresChoice = known.includes(String(r.expires_days))
        ? String(r.expires_days)
        : String(r.expires_days); // fall back to raw
    }
    setForm({
      milestone_choice: preset ? String(r.milestone) : "custom",
      milestone_custom: preset ? "" : String(r.milestone),
      reward_type: r.reward_type,
      percent_value: r.reward_type === "discount_percent" ? String(r.reward_value) : "10",
      credit_dollars: r.reward_type === "bonus_credit" ? centsToDollars(r.reward_value) : "5.00",
      title: r.title,
      description: r.description ?? "",
      expires_choice: expiresChoice,
      is_active: r.is_active,
    });
    setEditingId(r.id);
    setShowForm(true);
    setError("");
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  };

  const resolveMilestone = (): number | null => {
    if (form.milestone_choice === "custom") {
      const n = parseInt(form.milestone_custom, 10);
      if (isNaN(n) || n <= 0) return null;
      return n;
    }
    const n = parseInt(form.milestone_choice, 10);
    return isNaN(n) ? null : n;
  };

  const resolveRewardValue = (): number => {
    if (form.reward_type === "discount_percent") {
      const n = parseInt(form.percent_value, 10);
      if (isNaN(n)) return 0;
      return Math.min(100, Math.max(1, n));
    }
    if (form.reward_type === "bonus_credit") {
      return dollarsToCents(form.credit_dollars);
    }
    return 0;
  };

  const resolveExpiresDays = (): number | null => {
    if (form.expires_choice === "never") return null;
    const n = parseInt(form.expires_choice, 10);
    return isNaN(n) ? null : n;
  };

  const handleSave = async () => {
    if (!admin?.clubId) return;

    const milestone = resolveMilestone();
    if (milestone == null) {
      setError("Milestone must be a positive integer");
      return;
    }
    if (!form.title.trim()) {
      setError("Title is required");
      return;
    }
    if (form.title.trim().length > 80) {
      setError("Title must be 80 characters or fewer");
      return;
    }

    const rewardValue = resolveRewardValue();
    if (form.reward_type === "discount_percent" && (rewardValue < 1 || rewardValue > 100)) {
      setError("Discount percent must be between 1 and 100");
      return;
    }
    if (form.reward_type === "bonus_credit" && rewardValue < 100) {
      setError("Bonus credit must be at least $1.00");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const supabase = createClient();
      const payload = {
        club_id: admin.clubId,
        milestone,
        reward_type: form.reward_type,
        reward_value: rewardValue,
        title: form.title.trim(),
        description: form.description.trim() || null,
        expires_days: resolveExpiresDays(),
        is_active: form.is_active,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error: updateError } = await supabase
          .from("milestone_rewards")
          .update(payload)
          .eq("id", editingId);
        if (updateError) throw updateError;
        showToast("Reward updated");
      } else {
        const { error: insertError } = await supabase
          .from("milestone_rewards")
          .insert(payload);
        if (insertError) throw insertError;
        showToast("Reward created");
      }

      closeForm();
      fetchRewards(admin.clubId);
      fetchAdoption(admin.clubId);
    } catch (err) {
      console.error("Error saving reward:", err);
      setError(err instanceof Error ? err.message : "Failed to save reward");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (r: MilestoneReward) => {
    if (!admin?.clubId) return;
    setTogglingId(r.id);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("milestone_rewards")
        .update({ is_active: !r.is_active, updated_at: new Date().toISOString() })
        .eq("id", r.id);
      if (updateError) throw updateError;
      showToast(r.is_active ? "Reward disabled" : "Reward enabled");
      fetchRewards(admin.clubId);
      fetchAdoption(admin.clubId);
    } catch (err) {
      console.error("Error toggling reward:", err);
      showToast("Failed to update reward", "error");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (rewardId: string) => {
    if (!admin?.clubId) return;
    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase
        .from("milestone_rewards")
        .delete()
        .eq("id", rewardId);
      if (deleteError) throw deleteError;
      setDeletingId(null);
      showToast("Reward deleted");
      fetchRewards(admin.clubId);
      fetchAdoption(admin.clubId);
    } catch (err) {
      console.error("Error deleting reward:", err);
      setError(err instanceof Error ? err.message : "Failed to delete reward");
      setDeletingId(null);
    }
  };

  if (adminLoading || loading) {
    return (
      <div>
        <PageHeader title="Rewards Program" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  // Group rewards by milestone
  const byMilestone = new Map<number, MilestoneReward[]>();
  for (const r of rewards) {
    const arr = byMilestone.get(r.milestone) ?? [];
    arr.push(r);
    byMilestone.set(r.milestone, arr);
  }

  const customMilestones = Array.from(byMilestone.keys())
    .filter((m) => !PRESET_SET.has(m))
    .sort((a, b) => a - b);

  const suggestedPlaceholder =
    REWARD_TYPE_OPTIONS.find((t) => t.value === form.reward_type)?.placeholder ?? "";

  const renderRewardCard = (r: MilestoneReward) => {
    const stats = statsByReward[r.id] ?? { earned: 0, redeemed: 0 };
    return (
      <Card key={r.id} className={!r.is_active ? "opacity-70" : undefined}>
        <div className="flex items-start justify-between mb-3 gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-base font-bold text-slate-900 truncate">{r.title}</h3>
              {!r.is_active && <Badge label="Disabled" variant="default" />}
            </div>
            <Badge label={formatRewardValue(r)} variant="brand" />
          </div>

          {/* Enable / disable toggle */}
          <button
            type="button"
            onClick={() => handleToggleActive(r)}
            disabled={togglingId === r.id}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
              r.is_active ? "bg-brand" : "bg-slate-300"
            } ${togglingId === r.id ? "opacity-50" : ""}`}
            aria-pressed={r.is_active}
            aria-label={r.is_active ? "Disable reward" : "Enable reward"}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                r.is_active ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {r.description && (
          <p className="text-sm text-slate-600 mb-3 line-clamp-3">{r.description}</p>
        )}

        <p className="text-xs text-slate-500 mb-3">{formatExpiration(r.expires_days)}</p>

        <p className="text-xs text-slate-400 mb-4">
          Earned by {stats.earned} {stats.earned === 1 ? "player" : "players"}, redeemed by {stats.redeemed}
        </p>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => openEditForm(r)} fullWidth>
            Edit
          </Button>
          <Button variant="danger" size="sm" onClick={() => setDeletingId(r.id)}>
            Delete
          </Button>
        </div>
      </Card>
    );
  };

  const renderSection = (milestone: number, label: string) => {
    const list = byMilestone.get(milestone) ?? [];
    return (
      <section key={milestone} className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{label}</h2>
            <p className="text-xs text-slate-500">
              {list.length === 0
                ? "No rewards yet"
                : `${list.length} reward${list.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => openAddForm(milestone)}>
            + Add reward
          </Button>
        </div>

        {list.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-500 text-center py-6">
              No rewards set for this milestone yet
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {list.map(renderRewardCard)}
          </div>
        )}
      </section>
    );
  };

  return (
    <div>
      <PageHeader
        title="Rewards Program"
        subtitle="Unlock perks for players who keep coming back"
        action={
          !showForm ? (
            <Button onClick={() => openAddForm()} size="lg">
              Add Reward
            </Button>
          ) : undefined
        }
      />

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 right-6 text-white px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium z-50 ${
            toastVariant === "success" ? "bg-success" : "bg-error"
          }`}
        >
          {toast}
        </div>
      )}

      {/* Error */}
      {error && !showForm && (
        <div className="bg-error-light border border-red-200 text-error px-4 py-3 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      {/* Adoption stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Active rewards defined"
          value={adoption.totalDefined}
          subtitle="Currently offered to players"
        />
        <StatCard
          label="Granted this month"
          value={adoption.grantedThisMonth}
          subtitle="Players who hit a milestone"
        />
        <StatCard
          label="Redeemed this month"
          value={adoption.redeemedThisMonth}
          subtitle="Rewards actually used"
        />
      </div>

      {/* Preset milestone sections */}
      {PRESET_MILESTONES.map((m) => renderSection(m.value, m.label))}

      {/* Custom milestones */}
      {customMilestones.length > 0 && (
        <section className="mb-8">
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-slate-900">Custom milestones</h2>
            <p className="text-xs text-slate-500">Rewards at milestones outside the standard set</p>
          </div>
          {customMilestones.map((m) => (
            <div key={m} className="mb-6">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">{milestoneLabel(m)}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {(byMilestone.get(m) ?? []).map(renderRewardCard)}
              </div>
            </div>
          ))}
        </section>
      )}

      {rewards.length === 0 && (
        <Card>
          <EmptyState
            icon={
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
            }
            title="No rewards configured"
            description="Create milestone rewards to celebrate players who keep coming back."
            action={
              <Button onClick={() => openAddForm()} size="lg">
                Create Your First Reward
              </Button>
            }
          />
        </Card>
      )}

      {/* Reward modal */}
      <Modal
        open={showForm}
        onClose={closeForm}
        title={editingId ? "Edit Reward" : "New Reward"}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={closeForm}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {saving ? "Saving..." : editingId ? "Update Reward" : "Create Reward"}
            </Button>
          </>
        }
      >
        {error && (
          <div className="bg-error-light border border-red-200 text-error px-4 py-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <FormSelect
            label="Milestone"
            value={form.milestone_choice}
            onChange={(val) => setForm({ ...form, milestone_choice: val })}
            options={[
              ...PRESET_MILESTONES.map((m) => ({
                value: String(m.value),
                label: m.label,
              })),
              { value: "custom", label: "Custom..." },
            ]}
          />
          {form.milestone_choice === "custom" && (
            <FormInput
              label="Custom milestone (weeks)"
              type="number"
              min={1}
              value={form.milestone_custom}
              onChange={(val) => setForm({ ...form, milestone_custom: val })}
              placeholder="e.g. 16"
            />
          )}
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Reward type</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {REWARD_TYPE_OPTIONS.map((opt) => {
              const selected = form.reward_type === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setForm({ ...form, reward_type: opt.value })}
                  className={`text-left px-3 py-2.5 rounded-lg border transition-colors ${
                    selected
                      ? "border-brand bg-brand-surface"
                      : "border-slate-300 hover:border-slate-400"
                  }`}
                  aria-pressed={selected}
                >
                  <p className="text-sm font-semibold text-slate-900">{opt.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{opt.blurb}</p>
                </button>
              );
            })}
          </div>
        </div>

        {form.reward_type === "discount_percent" && (
          <div className="mb-4">
            <FormInput
              label="Discount percent (1-100) *"
              type="number"
              min={1}
              max={100}
              value={form.percent_value}
              onChange={(val) => setForm({ ...form, percent_value: val })}
              helperText="Applied to the player's next court booking"
            />
          </div>
        )}

        {form.reward_type === "bonus_credit" && (
          <div className="mb-4">
            <FormInput
              label="Credit amount ($) *"
              type="number"
              min={1}
              step={0.5}
              value={form.credit_dollars}
              onChange={(val) => setForm({ ...form, credit_dollars: val })}
              helperText="Minimum $1.00. Credited to the player's account."
            />
          </div>
        )}

        <div className="mb-4">
          <FormInput
            label="Title *"
            value={form.title}
            onChange={(val) => setForm({ ...form, title: val.slice(0, 80) })}
            placeholder={suggestedPlaceholder}
            helperText={`${form.title.length}/80 characters`}
          />
        </div>

        <div className="mb-4">
          <FormTextarea
            label="Description (optional)"
            value={form.description}
            onChange={(val) => setForm({ ...form, description: val })}
            placeholder="Tell players what this unlocks and how to use it"
            rows={3}
            maxLength={300}
          />
        </div>

        <div className="mb-4">
          <FormSelect
            label="Expires in"
            value={form.expires_choice}
            onChange={(val) => setForm({ ...form, expires_choice: val })}
            options={EXPIRES_OPTIONS}
          />
        </div>

        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
          <label className="flex items-center gap-3 cursor-pointer">
            <button
              type="button"
              onClick={() => setForm({ ...form, is_active: !form.is_active })}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                form.is_active ? "bg-brand" : "bg-slate-300"
              }`}
              aria-pressed={form.is_active}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  form.is_active ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
            <div>
              <p className="text-sm font-semibold text-slate-900">Active</p>
              <p className="text-xs text-slate-500">
                Only active rewards are granted when players hit the milestone.
              </p>
            </div>
          </label>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        open={!!deletingId}
        onClose={() => setDeletingId(null)}
        title="Delete Reward"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeletingId(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => deletingId && handleDelete(deletingId)}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 mb-1">
          Are you sure you want to delete{" "}
          <span className="font-semibold">
            {rewards.find((r) => r.id === deletingId)?.title}
          </span>
          ?
        </p>
        <p className="text-xs text-slate-500">
          Players who already earned this reward keep their copy. Future milestone earners will not receive it.
        </p>
      </Modal>
    </div>
  );
}
