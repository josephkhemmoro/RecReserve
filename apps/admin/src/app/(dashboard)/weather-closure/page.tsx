"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAdminClub } from "@/lib/useAdminClub";
import { PageHeader, Card, Button, Badge, FormInput, FormSelect, EmptyState, Skeleton } from "@/components/ui";

interface Court {
  id: string;
  name: string;
}

interface Closure {
  id: string;
  court_id: string;
  starts_at: string;
  ends_at: string;
  reason: string;
  court_name: string;
  created_at: string;
}

const REASON_OPTIONS = [
  { value: "weather", label: "Weather" },
  { value: "maintenance", label: "Maintenance" },
  { value: "event", label: "Private Event" },
  { value: "other", label: "Other" },
];

export default function WeatherClosurePage() {
  const { admin, loading: adminLoading } = useAdminClub();
  const [courts, setCourts] = useState<Court[]>([]);
  const [closures, setClosures] = useState<Closure[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    court_id: "all",
    date: "",
    start_time: "00:00",
    end_time: "23:59",
    reason: "weather",
    notes: "",
  });

  const fetchData = useCallback(async () => {
    if (!admin?.clubId) return;
    try {
      const supabase = createClient();
      const [courtsRes, closuresRes] = await Promise.all([
        supabase.from("courts").select("id, name").eq("club_id", admin.clubId).eq("is_active", true).order("name"),
        supabase.from("court_closures")
          .select("id, court_id, starts_at, ends_at, reason, created_at, court:courts(name)")
          .eq("club_id", admin.clubId)
          .gte("ends_at", new Date().toISOString())
          .order("starts_at", { ascending: true }),
      ]);

      setCourts((courtsRes.data ?? []).map((c) => ({ id: c.id as string, name: c.name as string })));
      setClosures(
        (closuresRes.data ?? []).map((c) => ({
          id: c.id as string,
          court_id: c.court_id as string,
          starts_at: c.starts_at as string,
          ends_at: c.ends_at as string,
          reason: c.reason as string,
          court_name: (c.court as { name: string } | null)?.name ?? "Unknown",
          created_at: c.created_at as string,
        }))
      );
    } catch (err) {
      console.error("Error fetching closures:", err);
    } finally {
      setLoading(false);
    }
  }, [admin?.clubId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async () => {
    if (!admin?.clubId || !form.date) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const startsAt = `${form.date}T${form.start_time}:00`;
      const endsAt = `${form.date}T${form.end_time}:00`;

      const targetCourts = form.court_id === "all" ? courts : courts.filter((c) => c.id === form.court_id);

      for (const court of targetCourts) {
        await supabase.from("court_closures").insert({
          court_id: court.id,
          club_id: admin.clubId,
          starts_at: startsAt,
          ends_at: endsAt,
          reason: form.notes ? `${form.reason}: ${form.notes}` : form.reason,
          closed_by: admin.userId,
        });
      }

      // Auto-cancel affected reservations and notify members
      const affectedCourtIds = targetCourts.map((c) => c.id);

      const { data: affectedReservations } = await supabase
        .from("reservations")
        .select("id, user_id, start_time, court:courts(name), user:users!reservations_user_id_fkey(full_name, push_token)")
        .in("court_id", affectedCourtIds)
        .eq("status", "confirmed")
        .gte("start_time", startsAt)
        .lte("start_time", endsAt);

      for (const res of affectedReservations ?? []) {
        // Cancel the reservation
        await supabase.from("reservations").update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancelled_by: admin.userId,
        }).eq("id", res.id);

        const court = res.court as { name: string } | null;
        const user = res.user as { full_name: string; push_token: string | null } | null;
        const reasonText = form.notes ? `${form.reason}: ${form.notes}` : form.reason;

        // Create notification
        await supabase.from("notifications").insert({
          user_id: res.user_id,
          club_id: admin.clubId,
          title: "Court Closure — Booking Cancelled",
          body: `${court?.name || "Your court"} is closed on ${form.date} due to ${reasonText}. Your booking has been cancelled.`,
          type: "cancellation",
          read: false,
        });

        // Log to communication_log
        await supabase.from("communication_log").insert({
          club_id: admin.clubId,
          recipient_id: res.user_id,
          channel: "in_app",
          subject: "Court Closure — Booking Cancelled",
          body: `${court?.name || "Court"} closed on ${form.date} due to ${reasonText}. Booking cancelled.`,
          trigger_type: "automated",
          trigger_source: "weather_closure",
          entity_type: "court_closure",
          status: "sent",
          sent_by: admin.userId,
        });

        // Audit log
        await supabase.from("audit_logs").insert({
          club_id: admin.clubId,
          actor_id: admin.userId,
          actor_role: "admin",
          action: "reservation.cancel",
          entity_type: "reservation",
          entity_id: res.id,
          changes: { status: { old: "confirmed", new: "cancelled" }, reason: { old: null, new: "weather_closure" } },
        });
      }

      setShowForm(false);
      setForm({ court_id: "all", date: "", start_time: "00:00", end_time: "23:59", reason: "weather", notes: "" });
      fetchData();
    } catch (err) {
      console.error("Error creating closure:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const supabase = createClient();
      await supabase.from("court_closures").delete().eq("id", id);
      fetchData();
    } catch (err) {
      console.error("Error deleting closure:", err);
    }
  };

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  const reasonLabel = (r: string) => {
    const base = r.split(":")[0];
    const opt = REASON_OPTIONS.find((o) => o.value === base);
    return opt?.label ?? r;
  };

  const reasonVariant = (r: string): "warning" | "info" | "default" | "brand" => {
    if (r.startsWith("weather")) return "warning";
    if (r.startsWith("maintenance")) return "info";
    if (r.startsWith("event")) return "brand";
    return "default";
  };

  const isLoading = adminLoading || loading;

  return (
    <div>
      <PageHeader
        title="Court Closures"
        action={<Button onClick={() => setShowForm(true)}>Add Closure</Button>}
      />

      {showForm && (
        <Card title="New Closure" className="mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormSelect
              label="Court"
              value={form.court_id}
              onChange={(v) => setForm({ ...form, court_id: v })}
              options={[{ value: "all", label: "All Courts" }, ...courts.map((c) => ({ value: c.id, label: c.name }))]}
            />
            <FormSelect
              label="Reason"
              value={form.reason}
              onChange={(v) => setForm({ ...form, reason: v })}
              options={REASON_OPTIONS}
            />
            <FormInput
              label="Date"
              type="date"
              value={form.date}
              onChange={(v) => setForm({ ...form, date: v })}
            />
            <div className="flex gap-2">
              <FormInput
                label="From"
                type="time"
                value={form.start_time}
                onChange={(v) => setForm({ ...form, start_time: v })}
                className="flex-1"
              />
              <FormInput
                label="To"
                type="time"
                value={form.end_time}
                onChange={(v) => setForm({ ...form, end_time: v })}
                className="flex-1"
              />
            </div>
            <FormInput
              label="Notes (optional)"
              value={form.notes}
              onChange={(v) => setForm({ ...form, notes: v })}
              placeholder="Heavy rain expected"
              className="sm:col-span-2"
            />
          </div>
          <div className="flex gap-3 mt-4">
            <Button onClick={handleCreate} disabled={saving || !form.date} loading={saving}>
              {saving ? "Creating..." : "Create Closure"}
            </Button>
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </Card>
      )}

      <Card title="Active & Upcoming Closures" noPadding>
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : closures.length === 0 ? (
          <EmptyState title="No closures scheduled" description="All courts are open." />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Court</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">From</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">To</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Reason</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {closures.map((c) => (
                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-6 py-3 text-sm font-medium text-slate-900">{c.court_name}</td>
                  <td className="px-6 py-3 text-sm text-slate-600">{formatDateTime(c.starts_at)}</td>
                  <td className="px-6 py-3 text-sm text-slate-600">{formatDateTime(c.ends_at)}</td>
                  <td className="px-6 py-3"><Badge label={reasonLabel(c.reason)} variant={reasonVariant(c.reason)} /></td>
                  <td className="px-6 py-3 text-right">
                    <Button variant="danger" size="sm" onClick={() => handleDelete(c.id)}>Remove</Button>
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
