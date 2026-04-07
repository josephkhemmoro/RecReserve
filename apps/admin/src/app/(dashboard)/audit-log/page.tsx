"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAdminClub } from "@/lib/useAdminClub";
import { PageHeader, Card, Badge, FormInput, FormSelect, EmptyState, Skeleton } from "@/components/ui";

interface AuditEntry {
  id: string;
  actor_id: string;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  changes: Record<string, { old: unknown; new: unknown }> | null;
  created_at: string;
  actor_name: string | null;
}

const ENTITY_FILTER_OPTIONS = [
  { value: "all", label: "All Types" },
  { value: "reservation", label: "Reservations" },
  { value: "membership", label: "Memberships" },
  { value: "payment", label: "Payments" },
  { value: "booking_policy", label: "Booking Policies" },
  { value: "booking_rule", label: "Booking Rules" },
];

const ACTION_VARIANT: Record<string, "brand" | "success" | "warning" | "error" | "default" | "info"> = {
  "reservation.create": "success",
  "reservation.cancel": "error",
  "reservation.status_change": "warning",
  "reservation.no_show": "error",
  "payment.create": "success",
  "payment.refund": "warning",
  "payment.status_change": "info",
  "membership.join": "success",
  "membership.suspend": "error",
  "membership.activate": "success",
  "membership.status_change": "warning",
};

export default function AuditLogPage() {
  const { admin, loading: adminLoading } = useAdminClub();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");

  const fetchLogs = useCallback(async () => {
    if (!admin?.clubId) return;
    setLoading(true);
    try {
      const supabase = createClient();
      let query = supabase
        .from("audit_logs")
        .select("id, actor_id, actor_role, action, entity_type, entity_id, changes, created_at")
        .eq("club_id", admin.clubId)
        .order("created_at", { ascending: false })
        .limit(100);

      if (entityFilter !== "all") {
        query = query.eq("entity_type", entityFilter);
      }
      if (dateFrom) {
        query = query.gte("created_at", `${dateFrom}T00:00:00`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch actor names from public.users
      const actorIds = [...new Set((data ?? []).map((e) => e.actor_id as string).filter(Boolean))];
      const nameMap = new Map<string, string>();
      if (actorIds.length > 0) {
        const { data: users } = await supabase.from("users").select("id, full_name").in("id", actorIds);
        for (const u of users ?? []) nameMap.set(u.id as string, u.full_name as string);
      }

      setEntries(
        (data ?? []).map((e) => ({
          id: e.id as string,
          actor_id: e.actor_id as string,
          actor_role: e.actor_role as string | null,
          action: e.action as string,
          entity_type: e.entity_type as string,
          entity_id: e.entity_id as string | null,
          changes: e.changes as Record<string, { old: unknown; new: unknown }> | null,
          created_at: e.created_at as string,
          actor_name: nameMap.get(e.actor_id as string) ?? null,
        }))
      );
    } catch (err) {
      console.error("Error fetching audit logs:", err);
    } finally {
      setLoading(false);
    }
  }, [admin?.clubId, entityFilter, dateFrom]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const formatAction = (action: string) => action.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const formatChanges = (changes: Record<string, { old: unknown; new: unknown }> | null) => {
    if (!changes) return "—";
    return Object.entries(changes)
      .map(([field, { old: oldVal, new: newVal }]) => `${field}: ${String(oldVal ?? "—")} → ${String(newVal ?? "—")}`)
      .join(", ");
  };

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  const isLoading = adminLoading || loading;

  return (
    <div>
      <PageHeader title="Audit Log" />

      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <FormSelect label="Entity Type" value={entityFilter} onChange={setEntityFilter} options={ENTITY_FILTER_OPTIONS} />
          <FormInput label="From Date" type="date" value={dateFrom} onChange={setDateFrom} />
        </div>
      </Card>

      <Card noPadding>
        {isLoading ? (
          <div className="p-6 space-y-3">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : entries.length === 0 ? (
          <EmptyState title="No audit entries" description="Actions will be logged here as they occur." />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Action</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Entity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Changes</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-6 py-3 text-sm text-slate-600 whitespace-nowrap">{formatTime(e.created_at)}</td>
                  <td className="px-6 py-3">
                    <p className="text-sm font-medium text-slate-900">{e.actor_name ?? "System"}</p>
                    {e.actor_role && <p className="text-xs text-slate-400">{e.actor_role}</p>}
                  </td>
                  <td className="px-6 py-3">
                    <Badge label={formatAction(e.action)} variant={ACTION_VARIANT[e.action] ?? "default"} />
                  </td>
                  <td className="px-6 py-3 text-sm text-slate-600">
                    {e.entity_type}
                    {e.entity_id && <span className="text-xs text-slate-400 ml-1">({e.entity_id.slice(0, 8)}...)</span>}
                  </td>
                  <td className="px-6 py-3 text-xs text-slate-500 max-w-xs truncate">{formatChanges(e.changes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
