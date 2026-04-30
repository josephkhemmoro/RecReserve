"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAdminClub } from "@/lib/useAdminClub";
import { PageHeader, Card, Badge, Button, Modal, FormInput, FormTextarea, EmptyState, SkeletonCard } from "@/components/ui";

interface Tier {
  id: string;
  club_id: string;
  name: string;
  discount_percent: number;
  can_book_free: boolean;
  color: string | null;
  is_paid: boolean;
  monthly_price_cents: number;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  is_default: boolean;
  sort_order: number;
  description: string | null;
  benefits: string[] | null;
  created_at: string;
}

interface TierForm {
  name: string;
  discount_percent: number;
  can_book_free: boolean;
  color: string;
  is_paid: boolean;
  monthly_price_dollars: string; // string to allow empty / partial entry
  description: string;
  benefits: string[];
}

const emptyForm: TierForm = {
  name: "",
  discount_percent: 0,
  can_book_free: false,
  color: "#2563eb",
  is_paid: false,
  monthly_price_dollars: "",
  description: "",
  benefits: [],
};

function centsToDollars(cents: number): string {
  if (!cents || cents <= 0) return "";
  return (cents / 100).toFixed(2);
}

function dollarsToCents(dollars: string): number {
  const n = parseFloat(dollars);
  if (isNaN(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function formatPrice(cents: number): string {
  if (!cents) return "";
  const whole = Math.floor(cents / 100);
  const fraction = cents % 100;
  return fraction === 0 ? `$${whole}` : `$${(cents / 100).toFixed(2)}`;
}

export default function TierPricingPage() {
  const { admin, loading: adminLoading } = useAdminClub();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [toastVariant, setToastVariant] = useState<"success" | "error">("success");

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TierForm>(emptyForm);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchTiers = useCallback(async (clubId: string) => {
    try {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from("membership_tiers")
        .select("*")
        .eq("club_id", clubId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (fetchError) throw fetchError;
      setTiers((data ?? []) as Tier[]);
    } catch (err) {
      console.error("Error fetching tiers:", err);
      setError("Failed to load tiers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (admin?.clubId) {
      fetchTiers(admin.clubId);
    }
  }, [admin?.clubId, fetchTiers]);

  const showToast = (message: string, variant: "success" | "error" = "success") => {
    setToast(message);
    setToastVariant(variant);
    setTimeout(() => setToast(""), 3500);
  };

  const openAddForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
    setError("");
  };

  const openEditForm = (tier: Tier) => {
    setForm({
      name: tier.name,
      discount_percent: tier.discount_percent,
      can_book_free: tier.can_book_free,
      color: tier.color || "#2563eb",
      is_paid: tier.is_paid,
      monthly_price_dollars: centsToDollars(tier.monthly_price_cents),
      description: tier.description ?? "",
      benefits: Array.isArray(tier.benefits) ? [...tier.benefits] : [],
    });
    setEditingId(tier.id);
    setShowForm(true);
    setError("");
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setError("");
  };

  const syncTierToStripe = async (tierId: string): Promise<string | null> => {
    const supabase = createClient();
    const { data, error: fnError } = await supabase.functions.invoke(
      "create-tier-product",
      { body: { tier_id: tierId } }
    );
    if (fnError) return fnError.message || "Stripe sync failed";
    if (data?.error) return String(data.error);
    return null;
  };

  const handleSave = async () => {
    if (!admin?.clubId) return;
    if (!form.name.trim()) {
      setError("Membership name is required");
      return;
    }

    const monthlyCents = form.is_paid ? dollarsToCents(form.monthly_price_dollars) : 0;

    if (form.is_paid) {
      if (monthlyCents < 50) {
        setError("Paid tiers must charge at least $0.50/month");
        return;
      }
    }

    setSaving(true);
    setError("");

    try {
      const supabase = createClient();
      const payload = {
        club_id: admin.clubId,
        name: form.name.trim(),
        discount_percent: form.can_book_free || form.is_paid ? 0 : form.discount_percent,
        can_book_free: form.is_paid ? false : form.can_book_free,
        color: form.color || null,
        is_paid: form.is_paid,
        monthly_price_cents: monthlyCents,
        description: form.description.trim() || null,
        benefits: form.benefits.map((b) => b.trim()).filter(Boolean),
      };

      let tierId: string | null = editingId;

      if (editingId) {
        const { error: updateError } = await supabase
          .from("membership_tiers")
          .update(payload)
          .eq("id", editingId);
        if (updateError) throw updateError;

        if (admin?.userId && admin?.clubId) {
          await supabase.from("audit_logs").insert({
            club_id: admin.clubId,
            actor_id: admin.userId,
            actor_role: "admin",
            action: "pricing.change",
            entity_type: "membership_tier",
            entity_id: editingId,
            changes: { name: { old: null, new: form.name } },
          });
        }

        showToast("Membership updated");
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from("membership_tiers")
          .insert(payload)
          .select("id")
          .single();
        if (insertError) throw insertError;

        tierId = (inserted?.id as string) ?? null;

        if (admin?.userId && admin?.clubId) {
          await supabase.from("audit_logs").insert({
            club_id: admin.clubId,
            actor_id: admin.userId,
            actor_role: "admin",
            action: "pricing.change",
            entity_type: "membership_tier",
            entity_id: tierId,
            changes: { name: { old: null, new: form.name } },
          });
        }

        showToast("Membership created");
      }

      // If this is a paid tier, sync to Stripe (create product + price).
      // Don't block on failure — the tier is saved, just not yet monetizable.
      if (form.is_paid && tierId) {
        const syncError = await syncTierToStripe(tierId);
        if (syncError) {
          showToast(`Saved, but Stripe sync failed: ${syncError}`, "error");
        }
      }

      closeForm();
      fetchTiers(admin.clubId);
    } catch (err) {
      console.error("Error saving tier:", err);
      setError(err instanceof Error ? err.message : "Failed to save membership");
    } finally {
      setSaving(false);
    }
  };

  const handleManualSync = async (tier: Tier) => {
    if (!admin?.clubId) return;
    setSyncingId(tier.id);
    try {
      const syncError = await syncTierToStripe(tier.id);
      if (syncError) {
        showToast(`Stripe sync failed: ${syncError}`, "error");
      } else {
        showToast("Synced to Stripe");
        fetchTiers(admin.clubId);
      }
    } finally {
      setSyncingId(null);
    }
  };

  const handleDelete = async (tierId: string) => {
    if (!admin?.clubId) return;

    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase
        .from("membership_tiers")
        .delete()
        .eq("id", tierId);

      if (deleteError) throw deleteError;

      setDeletingId(null);
      showToast("Membership deleted");
      fetchTiers(admin.clubId);
    } catch (err) {
      console.error("Error deleting tier:", err);
      setError(err instanceof Error ? err.message : "Failed to delete tier");
      setDeletingId(null);
    }
  };

  if (adminLoading || loading) {
    return (
      <div>
        <PageHeader title="Memberships" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Memberships"
        subtitle="Create and manage membership types for your club"
        action={
          !showForm ? (
            <Button onClick={openAddForm} size="lg">
              Add Membership
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

      {/* Inline Form */}
      {showForm && (
        <Card title={editingId ? "Edit Membership" : "New Membership"} className="mb-8">
          {error && (
            <div className="bg-error-light border border-red-200 text-error px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          {/* Paid / free toggle */}
          <div className="mb-5 p-4 rounded-lg bg-slate-50 border border-slate-200">
            <label className="flex items-center gap-3 cursor-pointer">
              <button
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    is_paid: !form.is_paid,
                    // When switching to paid, clear free-tier toggles
                    can_book_free: false,
                    discount_percent: form.is_paid ? form.discount_percent : 0,
                  })
                }
                className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                  form.is_paid ? "bg-brand" : "bg-slate-300"
                }`}
                aria-pressed={form.is_paid}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    form.is_paid ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  This is a paid tier
                </p>
                <p className="text-xs text-slate-500">
                  Members subscribe monthly via Stripe. Cannot be the default tier.
                </p>
              </div>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <FormInput
              label="Membership Name *"
              value={form.name}
              onChange={(val) => setForm({ ...form, name: val })}
              placeholder="e.g. Premium, Guest, Student"
            />

            {form.is_paid ? (
              <FormInput
                label="Monthly Price ($) *"
                type="number"
                min={0.5}
                step={0.5}
                value={form.monthly_price_dollars}
                onChange={(val) => setForm({ ...form, monthly_price_dollars: val })}
                placeholder="29.00"
                helperText="Minimum $0.50/month. Charged monthly via Stripe."
              />
            ) : (
              <FormInput
                label="Discount %"
                type="number"
                min={0}
                max={100}
                value={form.discount_percent}
                onChange={(val) =>
                  setForm({
                    ...form,
                    discount_percent: Math.min(100, Math.max(0, Number(val))),
                  })
                }
                disabled={form.can_book_free}
              />
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="flex-1 px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                  placeholder="#2563eb"
                  maxLength={7}
                />
              </div>
            </div>

            {!form.is_paid && (
              <div className="flex items-end">
                <label className="flex items-center gap-3 cursor-pointer py-2.5">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, can_book_free: !form.can_book_free })}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      form.can_book_free ? "bg-brand" : "bg-slate-300"
                    }`}
                    aria-pressed={form.can_book_free}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        form.can_book_free ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                  <span className="text-sm font-medium text-slate-700">
                    Books free (no charge)
                  </span>
                </label>
              </div>
            )}
          </div>

          <div className="mb-4">
            <FormTextarea
              label="Description"
              value={form.description}
              onChange={(val) => setForm({ ...form, description: val })}
              placeholder="What does this membership include?"
              rows={3}
              maxLength={500}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Benefits
            </label>
            <p className="text-xs text-slate-500 mb-2">
              One perk per line. Shown to members on this tier&apos;s detail page.
            </p>
            <div className="space-y-2">
              {form.benefits.map((benefit, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={benefit}
                    onChange={(e) => {
                      const next = [...form.benefits];
                      next[idx] = e.target.value;
                      setForm({ ...form, benefits: next });
                    }}
                    placeholder={`Benefit ${idx + 1}`}
                    maxLength={120}
                    className="flex-1 px-3.5 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = form.benefits.filter((_, i) => i !== idx);
                      setForm({ ...form, benefits: next });
                    }}
                    className="px-3 py-2.5 rounded-lg border border-slate-300 text-slate-500 hover:text-error hover:border-error text-sm"
                    aria-label={`Remove benefit ${idx + 1}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setForm({ ...form, benefits: [...form.benefits, ""] })
                }
                className="text-sm font-medium text-brand hover:underline"
              >
                + Add benefit
              </button>
            </div>
          </div>

          {form.can_book_free && !form.is_paid && (
            <p className="text-xs text-slate-500 mb-4">
              Members on this membership will not be charged for court bookings. Discount % is ignored.
            </p>
          )}

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} loading={saving} size="lg">
              {saving ? "Saving..." : editingId ? "Update Membership" : "Create Membership"}
            </Button>
            <Button variant="secondary" onClick={closeForm} size="lg">
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Tier Cards */}
      {tiers.length === 0 && !showForm ? (
        <Card>
          <EmptyState
            icon={
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
              </svg>
            }
            title="No memberships yet"
            description="Create memberships to offer different pricing levels to your members."
            action={
              <Button onClick={openAddForm} size="lg">
                Create Your First Membership
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {tiers.map((tier) => {
            const needsSync = tier.is_paid && !tier.stripe_price_id;
            const synced = tier.is_paid && !!tier.stripe_price_id;
            return (
              <Card key={tier.id} className="relative overflow-hidden">
                {/* Color bar */}
                {tier.color && (
                  <div
                    className="absolute top-0 left-0 right-0 h-1.5"
                    style={{ backgroundColor: tier.color }}
                  />
                )}

                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {tier.color && (
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0 border border-slate-200"
                        style={{ backgroundColor: tier.color }}
                      />
                    )}
                    <h3 className="text-lg font-bold text-slate-900">{tier.name}</h3>
                    {tier.is_default && (
                      <Badge label="Default" variant="info" />
                    )}
                  </div>
                </div>

                {/* Price */}
                <div className="mb-3">
                  {tier.is_paid ? (
                    <p className="text-2xl font-bold text-slate-900">
                      {formatPrice(tier.monthly_price_cents)}
                      <span className="text-sm font-normal text-slate-500">/month</span>
                    </p>
                  ) : (
                    <p className="text-2xl font-bold text-slate-900">Free</p>
                  )}
                </div>

                {/* Description */}
                {tier.description && (
                  <p className="text-sm text-slate-600 mb-3 line-clamp-3">{tier.description}</p>
                )}

                {/* Benefits */}
                {Array.isArray(tier.benefits) && tier.benefits.length > 0 && (
                  <ul className="mb-4 space-y-1">
                    {tier.benefits.slice(0, 4).map((b, i) => (
                      <li key={i} className="text-xs text-slate-700 flex items-start gap-1.5">
                        <span className="text-brand mt-0.5">✓</span>
                        <span>{b}</span>
                      </li>
                    ))}
                    {tier.benefits.length > 4 && (
                      <li className="text-xs text-slate-400">
                        +{tier.benefits.length - 4} more
                      </li>
                    )}
                  </ul>
                )}

                <div className="flex flex-wrap gap-2 mb-4">
                  {tier.is_paid ? (
                    <Badge label="Paid tier" variant="brand" />
                  ) : tier.can_book_free ? (
                    <Badge label="Books Free" variant="success" />
                  ) : tier.discount_percent > 0 ? (
                    <Badge label={`${tier.discount_percent}% off`} variant="brand" />
                  ) : (
                    <Badge label="Full price" variant="default" />
                  )}

                  {synced && <Badge label="✓ Synced" variant="success" />}
                  {needsSync && <Badge label="⚠ Needs sync" variant="warning" />}
                </div>

                {needsSync && (
                  <div className="mb-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleManualSync(tier)}
                      loading={syncingId === tier.id}
                      fullWidth
                    >
                      {syncingId === tier.id ? "Syncing..." : "Sync to Stripe"}
                    </Button>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => openEditForm(tier)}
                    fullWidth
                  >
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setDeletingId(tier.id)}
                  >
                    Delete
                  </Button>
                </div>

                {tier.is_default && (
                  <p className="text-xs text-slate-400 mt-3">
                    Manage default tier from club settings.
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deletingId}
        onClose={() => setDeletingId(null)}
        title="Delete Membership"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeletingId(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => deletingId && handleDelete(deletingId)}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600 mb-1">
          Are you sure you want to delete{" "}
          <span className="font-semibold">
            {tiers.find((t) => t.id === deletingId)?.name}
          </span>
          ?
        </p>
        <p className="text-xs text-slate-500">
          Members currently on this membership will be unassigned.
        </p>
      </Modal>
    </div>
  );
}
