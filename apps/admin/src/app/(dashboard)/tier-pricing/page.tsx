"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAdminClub } from "@/lib/useAdminClub";
import { PageHeader, Card, Badge, Button, Modal, FormInput, EmptyState, SkeletonCard } from "@/components/ui";

interface Tier {
  id: string;
  club_id: string;
  name: string;
  discount_percent: number;
  can_book_free: boolean;
  color: string | null;
  created_at: string;
}

interface TierForm {
  name: string;
  discount_percent: number;
  can_book_free: boolean;
  color: string;
}

const emptyForm: TierForm = {
  name: "",
  discount_percent: 0,
  can_book_free: false,
  color: "#2563eb",
};

export default function TierPricingPage() {
  const { admin, loading: adminLoading } = useAdminClub();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

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
        .order("created_at", { ascending: true });

      if (fetchError) throw fetchError;
      setTiers(data ?? []);
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

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 3000);
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

  const handleSave = async () => {
    if (!admin?.clubId) return;
    if (!form.name.trim()) {
      setError("Membership name is required");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const supabase = createClient();
      const payload = {
        club_id: admin.clubId,
        name: form.name.trim(),
        discount_percent: form.can_book_free ? 0 : form.discount_percent,
        can_book_free: form.can_book_free,
        color: form.color || null,
      };

      if (editingId) {
        const { error: updateError } = await supabase
          .from("membership_tiers")
          .update(payload)
          .eq("id", editingId);
        if (updateError) throw updateError;

        // Audit log for update
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
        const { error: insertError } = await supabase
          .from("membership_tiers")
          .insert(payload);
        if (insertError) throw insertError;

        // Audit log for create
        if (admin?.userId && admin?.clubId) {
          await supabase.from("audit_logs").insert({
            club_id: admin.clubId,
            actor_id: admin.userId,
            actor_role: "admin",
            action: "pricing.change",
            entity_type: "membership_tier",
            entity_id: null,
            changes: { name: { old: null, new: form.name } },
          });
        }

        showToast("Membership created");
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
        <div className="fixed top-6 right-6 bg-success text-white px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium z-50">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <FormInput
              label="Membership Name *"
              value={form.name}
              onChange={(val) => setForm({ ...form, name: val })}
              placeholder="e.g. Premium, Guest, Student"
            />

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

            <div className="flex items-end">
              <label className="flex items-center gap-3 cursor-pointer py-2.5">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, can_book_free: !form.can_book_free })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    form.can_book_free ? "bg-brand" : "bg-slate-300"
                  }`}
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
          </div>

          {form.can_book_free && (
            <p className="text-xs text-slate-500 mb-4">
              Members on this membership will not be charged for court bookings. Discount % is ignored.
            </p>
          )}

          <div className="flex items-center gap-3">
            <Button
              onClick={handleSave}
              loading={saving}
              size="lg"
            >
              {saving ? "Saving..." : editingId ? "Update Membership" : "Create Membership"}
            </Button>
            <Button
              variant="secondary"
              onClick={closeForm}
              size="lg"
            >
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
          {tiers.map((tier) => (
            <Card key={tier.id} className="relative overflow-hidden">
              {/* Color bar */}
              {tier.color && (
                <div
                  className="absolute top-0 left-0 right-0 h-1.5"
                  style={{ backgroundColor: tier.color }}
                />
              )}

              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  {tier.color && (
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 border border-slate-200"
                      style={{ backgroundColor: tier.color }}
                    />
                  )}
                  <h3 className="text-lg font-bold text-slate-900">{tier.name}</h3>
                </div>
              </div>

              <div className="space-y-2 mb-5">
                {tier.can_book_free ? (
                  <Badge label="Books Free" variant="success" />
                ) : tier.discount_percent > 0 ? (
                  <Badge label={`${tier.discount_percent}% off`} variant="brand" />
                ) : (
                  <Badge label="Full price" variant="default" />
                )}
              </div>

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
            </Card>
          ))}
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
            <Button
              variant="secondary"
              onClick={() => setDeletingId(null)}
            >
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
