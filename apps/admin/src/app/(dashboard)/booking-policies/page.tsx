"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAdminClub } from "@/lib/useAdminClub";
import { PageHeader, Card, Button, Badge, Modal, FormInput, FormSelect, EmptyState, Skeleton } from "@/components/ui";

interface MembershipTier {
  id: string;
  name: string;
}

interface Court {
  id: string;
  name: string;
}

interface Policy {
  id: string;
  name: string;
  priority: number;
  is_active: boolean;
  tier_id: string | null;
  court_id: string | null;
  advance_booking_days: number | null;
  max_booking_duration_mins: number | null;
  max_active_reservations: number | null;
  max_guest_count: number | null;
  cancellation_cutoff_hours: number | null;
  cancellation_fee_cents: number | null;
  allow_recurring: boolean | null;
  max_recurring_weeks: number | null;
  blackout_start: string | null;
  blackout_end: string | null;
  blackout_reason: string | null;
  tier_name: string | null;
  court_name: string | null;
  created_at: string;
}

const EMPTY_FORM = {
  name: "",
  priority: "0",
  tier_id: "",
  court_id: "",
  advance_booking_days: "",
  max_booking_duration_mins: "",
  max_active_reservations: "",
  max_guest_count: "",
  cancellation_cutoff_hours: "",
  cancellation_fee_cents: "",
  allow_recurring: "true",
  max_recurring_weeks: "",
  blackout_start: "",
  blackout_end: "",
  blackout_reason: "",
};

export default function BookingPoliciesPage() {
  const { admin, loading: adminLoading } = useAdminClub();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [tiers, setTiers] = useState<MembershipTier[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!admin?.clubId) return;
    try {
      const supabase = createClient();
      const [policiesRes, tiersRes, courtsRes] = await Promise.all([
        supabase
          .from("booking_policies")
          .select("*, tier:membership_tiers(name), court:courts(name)")
          .eq("club_id", admin.clubId)
          .order("priority", { ascending: false }),
        supabase.from("membership_tiers").select("id, name").eq("club_id", admin.clubId),
        supabase.from("courts").select("id, name").eq("club_id", admin.clubId).eq("is_active", true),
      ]);

      setPolicies(
        (policiesRes.data ?? []).map((p) => ({
          ...p,
          id: p.id as string,
          name: p.name as string,
          priority: p.priority as number,
          is_active: p.is_active as boolean,
          tier_id: p.tier_id as string | null,
          court_id: p.court_id as string | null,
          advance_booking_days: p.advance_booking_days as number | null,
          max_booking_duration_mins: p.max_booking_duration_mins as number | null,
          max_active_reservations: p.max_active_reservations as number | null,
          max_guest_count: p.max_guest_count as number | null,
          cancellation_cutoff_hours: p.cancellation_cutoff_hours as number | null,
          cancellation_fee_cents: p.cancellation_fee_cents as number | null,
          allow_recurring: p.allow_recurring as boolean | null,
          max_recurring_weeks: p.max_recurring_weeks as number | null,
          blackout_start: p.blackout_start as string | null,
          blackout_end: p.blackout_end as string | null,
          blackout_reason: p.blackout_reason as string | null,
          tier_name: (p.tier as { name: string } | null)?.name ?? null,
          court_name: (p.court as { name: string } | null)?.name ?? null,
          created_at: p.created_at as string,
        }))
      );
      setTiers((tiersRes.data ?? []).map((t) => ({ id: t.id as string, name: t.name as string })));
      setCourts((courtsRes.data ?? []).map((c) => ({ id: c.id as string, name: c.name as string })));
    } catch (err) {
      console.error("Error fetching policies:", err);
    } finally {
      setLoading(false);
    }
  }, [admin?.clubId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    if (!admin?.clubId || !form.name.trim()) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const payload = {
        club_id: admin.clubId,
        name: form.name.trim(),
        priority: Number(form.priority) || 0,
        tier_id: form.tier_id || null,
        court_id: form.court_id || null,
        advance_booking_days: form.advance_booking_days ? Number(form.advance_booking_days) : null,
        max_booking_duration_mins: form.max_booking_duration_mins ? Number(form.max_booking_duration_mins) : null,
        max_active_reservations: form.max_active_reservations ? Number(form.max_active_reservations) : null,
        max_guest_count: form.max_guest_count ? Number(form.max_guest_count) : null,
        cancellation_cutoff_hours: form.cancellation_cutoff_hours ? Number(form.cancellation_cutoff_hours) : null,
        cancellation_fee_cents: form.cancellation_fee_cents ? Number(form.cancellation_fee_cents) : null,
        allow_recurring: form.allow_recurring === "true",
        max_recurring_weeks: form.max_recurring_weeks ? Number(form.max_recurring_weeks) : null,
        blackout_start: form.blackout_start || null,
        blackout_end: form.blackout_end || null,
        blackout_reason: form.blackout_reason || null,
      };

      if (editingId) {
        await supabase.from("booking_policies").update(payload).eq("id", editingId);
      } else {
        await supabase.from("booking_policies").insert(payload);
      }

      setShowForm(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      fetchData();
    } catch (err) {
      console.error("Error saving policy:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (p: Policy) => {
    setForm({
      name: p.name,
      priority: String(p.priority),
      tier_id: p.tier_id || "",
      court_id: p.court_id || "",
      advance_booking_days: p.advance_booking_days != null ? String(p.advance_booking_days) : "",
      max_booking_duration_mins: p.max_booking_duration_mins != null ? String(p.max_booking_duration_mins) : "",
      max_active_reservations: p.max_active_reservations != null ? String(p.max_active_reservations) : "",
      max_guest_count: p.max_guest_count != null ? String(p.max_guest_count) : "",
      cancellation_cutoff_hours: p.cancellation_cutoff_hours != null ? String(p.cancellation_cutoff_hours) : "",
      cancellation_fee_cents: p.cancellation_fee_cents != null ? String(p.cancellation_fee_cents) : "",
      allow_recurring: p.allow_recurring != null ? String(p.allow_recurring) : "true",
      max_recurring_weeks: p.max_recurring_weeks != null ? String(p.max_recurring_weeks) : "",
      blackout_start: p.blackout_start || "",
      blackout_end: p.blackout_end || "",
      blackout_reason: p.blackout_reason || "",
    });
    setEditingId(p.id);
    setShowForm(true);
  };

  const handleToggle = async (id: string, currentActive: boolean) => {
    try {
      const supabase = createClient();
      await supabase.from("booking_policies").update({ is_active: !currentActive }).eq("id", id);
      fetchData();
    } catch (err) {
      console.error("Error toggling policy:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this policy? This cannot be undone.")) return;
    try {
      const supabase = createClient();
      await supabase.from("booking_policies").delete().eq("id", id);
      fetchData();
    } catch (err) {
      console.error("Error deleting policy:", err);
    }
  };

  const getScopeLabel = (p: Policy) => {
    const parts = [];
    if (p.tier_name) parts.push(p.tier_name);
    if (p.court_name) parts.push(p.court_name);
    return parts.length > 0 ? parts.join(" + ") : "All members & courts";
  };

  const isLoading = adminLoading || loading;

  return (
    <div>
      <PageHeader
        title="Booking Policies"
        action={
          <Button onClick={() => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(true); }}>
            Add Policy
          </Button>
        }
      />

      <Card className="mb-6">
        <p className="text-sm text-slate-600">
          Policies override the base booking rules for specific tiers or courts.
          Higher priority policies take precedence. Leave fields blank to inherit from the base rules.
        </p>
      </Card>

      {showForm && (
        <Card title={editingId ? "Edit Policy" : "New Policy"} className="mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormInput label="Policy Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Premium Evening Access" />
            <FormInput label="Priority (higher overrides)" type="number" value={form.priority} onChange={(v) => setForm({ ...form, priority: v })} />
            <FormSelect label="Membership Tier" value={form.tier_id} onChange={(v) => setForm({ ...form, tier_id: v })} options={[{ value: "", label: "All Tiers" }, ...tiers.map((t) => ({ value: t.id, label: t.name }))]} />
            <FormSelect label="Court" value={form.court_id} onChange={(v) => setForm({ ...form, court_id: v })} options={[{ value: "", label: "All Courts" }, ...courts.map((c) => ({ value: c.id, label: c.name }))]} />
            <FormInput label="Advance Booking (days)" type="number" value={form.advance_booking_days} onChange={(v) => setForm({ ...form, advance_booking_days: v })} placeholder="Inherit from base" />
            <FormInput label="Max Duration (mins)" type="number" value={form.max_booking_duration_mins} onChange={(v) => setForm({ ...form, max_booking_duration_mins: v })} placeholder="Inherit" />
            <FormInput label="Max Active Reservations" type="number" value={form.max_active_reservations} onChange={(v) => setForm({ ...form, max_active_reservations: v })} placeholder="Inherit" />
            <FormInput label="Max Guests" type="number" value={form.max_guest_count} onChange={(v) => setForm({ ...form, max_guest_count: v })} placeholder="Inherit" />
            <FormInput label="Cancel Cutoff (hours)" type="number" value={form.cancellation_cutoff_hours} onChange={(v) => setForm({ ...form, cancellation_cutoff_hours: v })} placeholder="Inherit" />
            <FormInput label="Cancel Fee (cents)" type="number" value={form.cancellation_fee_cents} onChange={(v) => setForm({ ...form, cancellation_fee_cents: v })} placeholder="0" />
            <FormSelect label="Allow Recurring" value={form.allow_recurring} onChange={(v) => setForm({ ...form, allow_recurring: v })} options={[{ value: "true", label: "Yes" }, { value: "false", label: "No" }]} />
            <FormInput label="Max Recurring Weeks" type="number" value={form.max_recurring_weeks} onChange={(v) => setForm({ ...form, max_recurring_weeks: v })} placeholder="8" />
            <FormInput label="Blackout Start Date" type="date" value={form.blackout_start} onChange={(v) => setForm({ ...form, blackout_start: v })} />
            <FormInput label="Blackout End Date" type="date" value={form.blackout_end} onChange={(v) => setForm({ ...form, blackout_end: v })} />
            <FormInput label="Blackout Reason" value={form.blackout_reason} onChange={(v) => setForm({ ...form, blackout_reason: v })} placeholder="Holiday closure" className="sm:col-span-2 lg:col-span-3" />
          </div>
          <div className="flex gap-3 mt-4">
            <Button onClick={handleSave} disabled={saving || !form.name.trim()} loading={saving}>
              {saving ? "Saving..." : editingId ? "Update Policy" : "Create Policy"}
            </Button>
            <Button variant="secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</Button>
          </div>
        </Card>
      )}

      <Card title="Active Policies" noPadding>
        {isLoading ? (
          <div className="p-6 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : policies.length === 0 ? (
          <EmptyState title="No policies configured" description="Base booking rules apply to all members. Add policies for tier or court-specific overrides." />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Scope</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Key Rules</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-6 py-3 text-sm font-medium text-slate-900">{p.name}</td>
                  <td className="px-6 py-3 text-sm text-slate-600">{getScopeLabel(p)}</td>
                  <td className="px-6 py-3 text-sm text-slate-600">{p.priority}</td>
                  <td className="px-6 py-3">
                    <Badge label={p.is_active ? "Active" : "Inactive"} variant={p.is_active ? "success" : "default"} />
                    {p.blackout_start && <Badge label="Blackout" variant="warning" className="ml-1" />}
                  </td>
                  <td className="px-6 py-3 text-xs text-slate-500">
                    {[
                      p.advance_booking_days != null && `${p.advance_booking_days}d advance`,
                      p.max_active_reservations != null && `${p.max_active_reservations} max active`,
                      p.max_guest_count != null && `${p.max_guest_count} guests`,
                      p.cancellation_cutoff_hours != null && `${p.cancellation_cutoff_hours}h cancel`,
                    ].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-6 py-3 text-right space-x-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(p)}>Edit</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleToggle(p.id, p.is_active)}>
                      {p.is_active ? "Disable" : "Enable"}
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => handleDelete(p.id)}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
