"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAdminClub } from "@/lib/useAdminClub";
import { localDateStr } from "@/lib/dateUtils";
import { PageHeader, Card, Button, FormInput, Modal } from "@/components/ui";

function formatDateInput(d: Date): string {
  return localDateStr(d);
}

export default function WeatherClosurePage() {
  const { admin, loading: adminLoading } = useAdminClub();
  const [selectedDate, setSelectedDate] = useState(formatDateInput(new Date()));
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [result, setResult] = useState("");

  const checkReservations = async () => {
    if (!admin?.clubId) return;
    setLoading(true);
    setResult("");
    try {
      const supabase = createClient();
      const dayStart = `${selectedDate}T00:00:00`;
      const dayEnd = `${selectedDate}T23:59:59`;

      const { count: resCount, error } = await supabase
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .eq("club_id", admin.clubId)
        .eq("status", "confirmed")
        .gte("start_time", dayStart)
        .lte("start_time", dayEnd);

      if (error) throw error;
      setCount(resCount ?? 0);
    } catch (err) {
      console.error("Error checking reservations:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAll = async () => {
    if (!admin?.clubId) return;
    setCancelling(true);
    try {
      const supabase = createClient();
      const dayStart = `${selectedDate}T00:00:00`;
      const dayEnd = `${selectedDate}T23:59:59`;

      // Get affected reservations + user IDs
      const { data: affected, error: fetchErr } = await supabase
        .from("reservations")
        .select("id, user_id")
        .eq("club_id", admin.clubId)
        .eq("status", "confirmed")
        .gte("start_time", dayStart)
        .lte("start_time", dayEnd);

      if (fetchErr) throw fetchErr;

      if (!affected || affected.length === 0) {
        setResult("No reservations to cancel.");
        setShowConfirm(false);
        return;
      }

      // Bulk cancel
      const ids = affected.map((r: { id: string }) => r.id);
      const { error: updateErr } = await supabase
        .from("reservations")
        .update({ status: "cancelled" })
        .in("id", ids);

      if (updateErr) throw updateErr;

      // Send notifications to affected users
      const uniqueUserIds = [...new Set(affected.map((r: { user_id: string }) => r.user_id))];
      const clubName = admin?.clubName ?? "";
      const closureTitle = clubName
        ? `${clubName} - Weather Closure`
        : "Reservation Cancelled — Weather Closure";
      const notifications = uniqueUserIds.map((userId) => ({
        user_id: userId,
        title: closureTitle,
        body: `Your reservation on ${new Date(selectedDate).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} has been cancelled due to weather conditions.`,
        type: "cancellation" as const,
        read: false,
      }));

      if (notifications.length > 0) {
        await supabase.from("notifications").insert(notifications);
      }

      setResult(`Cancelled ${ids.length} reservation(s) and notified ${uniqueUserIds.length} player(s).`);
      setShowConfirm(false);
      setCount(0);
    } catch (err) {
      console.error("Error cancelling:", err);
      setResult("Error cancelling reservations. Please try again.");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div>
      <PageHeader title="Weather Closure" />

      <Card className="max-w-lg">
        <p className="text-sm text-slate-600 mb-4">
          Cancel all reservations for a specific day due to weather conditions.
          All affected players will be notified.
        </p>

        <FormInput
          label="Closure Date"
          type="date"
          value={selectedDate}
          onChange={(v) => {
            setSelectedDate(v);
            setCount(null);
            setResult("");
          }}
          className="mb-4"
        />

        <Button
          variant="secondary"
          onClick={checkReservations}
          disabled={loading || adminLoading}
          loading={loading}
        >
          {loading ? "Checking..." : "Check Reservations"}
        </Button>

        {count !== null && (
          <div className="mt-4 p-4 rounded-lg bg-brand-surface border border-slate-200">
            <p className="text-sm text-slate-700">
              <span className="font-bold text-2xl text-slate-900">{count}</span>{" "}
              confirmed reservation{count !== 1 ? "s" : ""} on{" "}
              {new Date(selectedDate).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
            {count > 0 && (
              <Button
                variant="danger"
                onClick={() => setShowConfirm(true)}
                className="mt-3"
              >
                Cancel All Reservations
              </Button>
            )}
          </div>
        )}

        {result && (
          <div
            className={`mt-4 px-4 py-3 rounded-lg text-sm font-medium ${
              result.includes("Error")
                ? "bg-error-light text-error"
                : "bg-success-light text-success"
            }`}
          >
            {result}
          </div>
        )}
      </Card>

      <Modal
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="Confirm Weather Closure"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowConfirm(false)}
            >
              Go Back
            </Button>
            <Button
              variant="danger"
              onClick={handleCancelAll}
              disabled={cancelling}
              loading={cancelling}
            >
              {cancelling ? "Cancelling..." : "Yes, Cancel All"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          This will cancel <strong>{count}</strong> reservation{count !== 1 ? "s" : ""}{" "}
          and notify all affected players. This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
