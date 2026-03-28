"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAdminClub } from "@/lib/useAdminClub";

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
        showToast("Membership updated");
      } else {
        const { error: insertError } = await supabase
          .from("membership_tiers")
          .insert(payload);
        if (insertError) throw insertError;
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
        <h1 className="text-2xl font-bold text-slate-900 mb-8">Memberships</h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse">
              <div className="h-5 w-32 bg-slate-200 rounded mb-3" />
              <div className="h-4 w-20 bg-slate-200 rounded mb-2" />
              <div className="h-4 w-24 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Memberships</h1>
          <p className="text-sm text-slate-500 mt-1">
            Create and manage membership types for your club
          </p>
        </div>
        {!showForm && (
          <button
            onClick={openAddForm}
            className="px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add Membership
          </button>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 bg-green-600 text-white px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium z-50">
          {toast}
        </div>
      )}

      {/* Error */}
      {error && !showForm && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      {/* Inline Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            {editingId ? "Edit Membership" : "New Membership"}
          </h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Membership Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Premium, Guest, Student"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Discount %
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={form.discount_percent}
                onChange={(e) =>
                  setForm({
                    ...form,
                    discount_percent: Math.min(100, Math.max(0, Number(e.target.value))),
                  })
                }
                disabled={form.can_book_free}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
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
                  className="flex-1 px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    form.can_book_free ? "bg-blue-600" : "bg-slate-300"
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
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : editingId ? "Update Membership" : "Create Membership"}
            </button>
            <button
              onClick={closeForm}
              className="px-5 py-2.5 text-slate-600 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tier Cards */}
      {tiers.length === 0 && !showForm ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">No memberships yet</h3>
          <p className="text-sm text-slate-500 mb-6">
            Create memberships to offer different pricing levels to your members.
          </p>
          <button
            onClick={openAddForm}
            className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Your First Membership
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className="bg-white rounded-xl border border-slate-200 p-6 relative group"
            >
              {/* Color bar */}
              {tier.color && (
                <div
                  className="absolute top-0 left-0 right-0 h-1.5 rounded-t-xl"
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
                  <span className="inline-block px-2.5 py-1 rounded-md text-xs font-semibold bg-green-50 text-green-700">
                    Books Free
                  </span>
                ) : tier.discount_percent > 0 ? (
                  <span className="inline-block px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700">
                    {tier.discount_percent}% off
                  </span>
                ) : (
                  <span className="inline-block px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-600">
                    Full price
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEditForm(tier)}
                  className="flex-1 px-3 py-2 text-sm font-medium text-slate-700 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => setDeletingId(tier.id)}
                  className="px-3 py-2 text-sm font-medium text-red-600 rounded-lg border border-red-200 hover:bg-red-50 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Membership</h3>
            <p className="text-sm text-slate-600 mb-1">
              Are you sure you want to delete{" "}
              <span className="font-semibold">
                {tiers.find((t) => t.id === deletingId)?.name}
              </span>
              ?
            </p>
            <p className="text-xs text-slate-500 mb-6">
              Members currently on this membership will be unassigned.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleDelete(deletingId)}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 px-4 py-2.5 text-slate-600 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
