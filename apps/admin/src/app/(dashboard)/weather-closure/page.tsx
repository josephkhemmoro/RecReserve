"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAdminClub } from "@/lib/useAdminClub";

function formatDateInput(d: Date): string {
  return d.toISOString().split("T")[0];
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
      const notifications = uniqueUserIds.map((userId) => ({
        user_id: userId,
        title: "Reservation Cancelled — Weather Closure",
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
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Weather Closure</h1>

      <div className="bg-white rounded-xl border border-slate-200 p-6 max-w-lg">
        <p className="text-sm text-slate-600 mb-4">
          Cancel all reservations for a specific day due to weather conditions.
          All affected players will be notified.
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Closure Date
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setCount(null);
              setResult("");
            }}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={checkReservations}
          disabled={loading || adminLoading}
          className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-900 disabled:opacity-50 transition-colors"
        >
          {loading ? "Checking..." : "Check Reservations"}
        </button>

        {count !== null && (
          <div className="mt-4 p-4 rounded-lg bg-slate-50 border border-slate-200">
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
              <button
                onClick={() => setShowConfirm(true)}
                className="mt-3 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
              >
                Cancel All Reservations
              </button>
            )}
          </div>
        )}

        {result && (
          <div
            className={`mt-4 px-4 py-3 rounded-lg text-sm font-medium ${
              result.includes("Error")
                ? "bg-red-50 text-red-700"
                : "bg-green-50 text-green-700"
            }`}
          >
            {result}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Confirm Weather Closure
            </h3>
            <p className="text-sm text-slate-600 mb-6">
              This will cancel <strong>{count}</strong> reservation{count !== 1 ? "s" : ""}{" "}
              and notify all affected players. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCancelAll}
                disabled={cancelling}
                className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {cancelling ? "Cancelling..." : "Yes, Cancel All"}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-slate-600 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
