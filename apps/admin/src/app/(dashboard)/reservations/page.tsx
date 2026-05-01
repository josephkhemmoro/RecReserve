"use client";

import React, { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { useAdminClub } from "@/lib/useAdminClub";
import Link from "next/link";
import { PageHeader, Card, Badge, Button, FormInput, FormSelect, EmptyState, SkeletonTableRow } from "@/components/ui";
import { useConfirm } from "@/components/ui/Dialog";

interface Reservation {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  amount_paid: number;
  guest_count: number;
  is_recurring: boolean;
  recurring_group_id: string | null;
  court: { name: string } | null;
  user: { id: string; full_name: string; email: string } | null;
}

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "confirmed", label: "Confirmed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "completed", label: "Completed" },
  { value: "no_show", label: "No-Show" },
];

const STATUS_BADGE: Record<string, "brand" | "success" | "warning" | "error" | "default"> = {
  confirmed: "brand",
  completed: "success",
  cancelled: "error",
  no_show: "warning",
  pending_payment: "warning",
};

export default function ReservationsPage() {
  const { admin, loading: adminLoading } = useAdminClub();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const confirm = useConfirm();

  const fetchReservations = useCallback(async () => {
    if (!admin?.clubId) return;
    setLoading(true);
    try {
      const supabase = createClient();
      let query = supabase
        .from("reservations")
        .select("id, start_time, end_time, status, amount_paid, guest_count, is_recurring, recurring_group_id, court:courts(name), user:users!reservations_user_id_fkey(id, full_name, email)")
        .eq("club_id", admin.clubId)
        .order("start_time", { ascending: false })
        .limit(200);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      if (dateFrom) {
        query = query.gte("start_time", `${dateFrom}T00:00:00`);
      }
      if (dateTo) {
        query = query.lte("start_time", `${dateTo}T23:59:59`);
      }

      const { data, error } = await query;
      if (error) throw error;

      setReservations(
        (data ?? []).map((r) => ({
          id: r.id as string,
          start_time: r.start_time as string,
          end_time: r.end_time as string,
          status: r.status as string,
          amount_paid: Number(r.amount_paid) || 0,
          guest_count: Number(r.guest_count) || 0,
          is_recurring: Boolean(r.is_recurring),
          recurring_group_id: r.recurring_group_id as string | null,
          court: r.court as { name: string } | null,
          user: r.user as { id: string; full_name: string; email: string } | null,
        }))
      );
    } catch (err) {
      console.error("Error fetching reservations:", err);
    } finally {
      setLoading(false);
    }
  }, [admin?.clubId, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  const handleMarkNoShow = async (id: string) => {
    const ok = await confirm({
      title: "Mark as no-show?",
      description: "The player won't be charged a fee automatically. This action is logged in the audit trail.",
      confirmLabel: "Mark No-Show",
      tone: "warning",
    });
    if (!ok) return;
    try {
      const supabase = createClient();
      await supabase.from("reservations").update({ status: "no_show" }).eq("id", id);

      if (admin?.userId && admin?.clubId) {
        await supabase.from("audit_logs").insert({
          club_id: admin.clubId,
          actor_id: admin.userId,
          actor_role: "admin",
          action: "reservation.no_show",
          entity_type: "reservation",
          entity_id: id,
          changes: { status: { old: "confirmed", new: "no_show" } },
        });
      }

      fetchReservations();
      toast.success("Marked as no-show");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark no-show");
    }
  };

  const handleCancelReservation = async (id: string) => {
    const ok = await confirm({
      title: "Cancel this reservation?",
      description: "The member will be notified. The action is logged.",
      confirmLabel: "Cancel Reservation",
      cancelLabel: "Keep Reservation",
      tone: "danger",
    });
    if (!ok) return;
    try {
      const supabase = createClient();
      await supabase.from("reservations").update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_by: admin?.userId,
      }).eq("id", id);

      await supabase.from("open_spots").delete().eq("reservation_id", id);
      await supabase.from("reservation_participants").delete().eq("reservation_id", id);

      if (admin?.userId && admin?.clubId) {
        await supabase.from("audit_logs").insert({
          club_id: admin.clubId,
          actor_id: admin.userId,
          actor_role: "admin",
          action: "reservation.cancel",
          entity_type: "reservation",
          entity_id: id,
          changes: { status: { old: "confirmed", new: "cancelled" } },
        });
      }

      fetchReservations();
      toast.success("Reservation cancelled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel");
    }
  };

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  const isLoading = adminLoading || loading;

  return (
    <div>
      <PageHeader title="Reservations" />

      {/* Filters */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <FormSelect
            label="Status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_OPTIONS}
          />
          <FormInput
            label="From"
            type="date"
            value={dateFrom}
            onChange={setDateFrom}
          />
          <FormInput
            label="To"
            type="date"
            value={dateTo}
            onChange={setDateTo}
          />
          <Button
            variant="secondary"
            onClick={() => { setStatusFilter("all"); setDateFrom(""); setDateTo(""); }}
          >
            Clear Filters
          </Button>
        </div>
      </Card>

      <Card noPadding>
        {isLoading ? (
          <div className="py-3 space-y-1">
            {[1, 2, 3, 4, 5].map((i) => <SkeletonTableRow key={i} />)}
          </div>
        ) : reservations.length === 0 ? (
          <EmptyState title="No reservations found" description="Adjust your filters or wait for bookings." />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Player</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Court</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date & Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Amount</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-6 py-3">
                    {r.user ? (
                      <Link href={`/members/${r.user.id}`} className="text-sm font-medium text-brand hover:underline">
                        {r.user.full_name}
                      </Link>
                    ) : (
                      <span className="text-sm text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-sm text-slate-600">
                    {r.court?.name ?? "—"}
                    {r.is_recurring && <span className="ml-1 text-xs text-purple-600">(recurring)</span>}
                  </td>
                  <td className="px-6 py-3 text-sm text-slate-600">{formatDateTime(r.start_time)}</td>
                  <td className="px-6 py-3">
                    <Badge label={r.status} variant={STATUS_BADGE[r.status] ?? "default"} />
                  </td>
                  <td className="px-6 py-3 text-sm text-slate-600">
                    {r.amount_paid > 0 ? `$${r.amount_paid.toFixed(2)}` : "Free"}
                  </td>
                  <td className="px-6 py-3 text-right space-x-2">
                    {r.status === "confirmed" && new Date(r.end_time) < new Date() && (
                      <Button variant="danger" size="sm" onClick={() => handleMarkNoShow(r.id)}>
                        No-Show
                      </Button>
                    )}
                    {r.status === "confirmed" && new Date(r.start_time) > new Date() && (
                      <Button variant="danger" size="sm" onClick={() => handleCancelReservation(r.id)}>
                        Cancel
                      </Button>
                    )}
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
