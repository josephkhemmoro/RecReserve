"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAdminClub } from "@/lib/useAdminClub";
import { localDateStr, localDayStart, localDayEnd } from "@/lib/dateUtils";

interface Court {
  id: string;
  name: string;
}

interface GridReservation {
  id: string;
  court_id: string;
  start_time: string;
  end_time: string;
  status: string;
  amount_paid: number;
  user: { full_name: string; email: string } | null;
}

const DEFAULT_HOURS = Array.from({ length: 14 }, (_, i) => i + 6); // 6AM to 7PM

function formatDateInput(d: Date): string {
  return localDateStr(d);
}

export default function ReservationsPage() {
  const { admin, loading: adminLoading } = useAdminClub();
  const [selectedDate, setSelectedDate] = useState(formatDateInput(new Date()));
  const [courts, setCourts] = useState<Court[]>([]);
  const [reservations, setReservations] = useState<GridReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<GridReservation | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [hours, setHours] = useState<number[]>(DEFAULT_HOURS);

  const fetchData = useCallback(async (clubId: string, date: string) => {
    setLoading(true);
    try {
      const supabase = createClient();
      const dateForBounds = new Date(date + "T00:00:00");
      const dayStart = localDayStart(dateForBounds);
      const dayEnd = localDayEnd(dateForBounds);

      const [courtsRes, resRes] = await Promise.all([
        supabase
          .from("courts")
          .select("id, name")
          .eq("club_id", clubId)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("reservations")
          .select("id, court_id, start_time, end_time, status, amount_paid, user:users(full_name, email)")
          .eq("club_id", clubId)
          .gte("start_time", dayStart)
          .lte("start_time", dayEnd)
          .eq("status", "confirmed"),
      ]);

      const courtList = (courtsRes.data ?? []) as Court[];
      setCourts(courtList);

      setReservations(
        (resRes.data ?? []).map((r: Record<string, unknown>) => ({
          id: r.id as string,
          court_id: r.court_id as string,
          start_time: r.start_time as string,
          end_time: r.end_time as string,
          status: r.status as string,
          amount_paid: r.amount_paid as number,
          user: r.user as { full_name: string; email: string } | null,
        }))
      );

      // Fetch court availability for this day to derive grid hours
      const dayOfWeek = new Date(date).getDay();
      if (courtList.length > 0) {
        const { data: avail } = await supabase
          .from("court_availability")
          .select("open_time, close_time")
          .in("court_id", courtList.map((c) => c.id))
          .eq("day_of_week", dayOfWeek);

        if (avail && avail.length > 0) {
          const minHour = Math.min(...avail.map((a: { open_time: string }) => parseInt(a.open_time.split(":")[0])));
          const maxHour = Math.max(...avail.map((a: { close_time: string }) => parseInt(a.close_time.split(":")[0])));
          setHours(Array.from({ length: maxHour - minHour + 1 }, (_, i) => i + minHour));
        } else {
          setHours(DEFAULT_HOURS);
        }
      } else {
        setHours(DEFAULT_HOURS);
      }
    } catch (err) {
      console.error("Error fetching grid data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (admin?.clubId) fetchData(admin.clubId, selectedDate);
  }, [admin?.clubId, selectedDate, fetchData]);

  const getReservationForCell = (courtId: string, hour: number): GridReservation | null => {
    return (
      reservations.find((r) => {
        if (r.court_id !== courtId) return false;
        const rHour = new Date(r.start_time).getHours();
        return rHour === hour;
      }) ?? null
    );
  };

  const handleCancel = async () => {
    if (!modal || !admin?.clubId) return;
    setCancelling(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("reservations")
        .update({ status: "cancelled" })
        .eq("id", modal.id);
      if (error) throw error;
      setModal(null);
      fetchData(admin.clubId, selectedDate);
    } catch (err) {
      console.error("Error cancelling:", err);
    } finally {
      setCancelling(false);
    }
  };

  const navigateDay = (offset: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(formatDateInput(d));
  };

  const isLoading = adminLoading || loading;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Reservations</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateDay(-1)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            ←
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900"
          />
          <button
            onClick={() => navigateDay(1)}
            className="px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            →
          </button>
          <button
            onClick={() => setSelectedDate(formatDateInput(new Date()))}
            className="px-3 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-dark"
          >
            Today
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        {isLoading ? (
          <div className="p-6 animate-pulse">
            <div className="h-64 bg-slate-100 rounded" />
          </div>
        ) : courts.length === 0 ? (
          <div className="p-10 text-center text-slate-500">No active courts</div>
        ) : (
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase w-32 sticky left-0 bg-white">
                  Court
                </th>
                {hours.map((h) => (
                  <th key={h} className="px-2 py-3 text-center text-xs font-medium text-slate-500 uppercase min-w-[80px]">
                    {h > 12 ? `${h - 12}PM` : h === 12 ? "12PM" : `${h}AM`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {courts.map((court) => (
                <tr key={court.id} className="border-b border-slate-50">
                  <td className="px-4 py-2 text-sm font-medium text-slate-900 sticky left-0 bg-white">
                    {court.name}
                  </td>
                  {hours.map((h) => {
                    const res = getReservationForCell(court.id, h);
                    return (
                      <td key={h} className="px-1 py-1">
                        {res ? (
                          <button
                            onClick={() => setModal(res)}
                            className="w-full px-2 py-1.5 rounded bg-brand-surface border border-brand-muted text-xs text-brand font-medium truncate hover:bg-brand-muted transition-colors"
                          >
                            {res.user?.full_name ?? "Booked"}
                          </button>
                        ) : (
                          <div className="w-full h-8 rounded bg-slate-50 border border-slate-100" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Reservation Detail Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              Reservation Details
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Player</span>
                <span className="text-slate-900 font-medium">
                  {modal.user?.full_name ?? modal.user?.email ?? "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Time</span>
                <span className="text-slate-900">
                  {new Date(modal.start_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  {" – "}
                  {new Date(modal.end_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount</span>
                <span className="text-slate-900">${Number(modal.amount_paid).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <span className="text-green-700 font-medium capitalize">{modal.status}</span>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {cancelling ? "Cancelling..." : "Cancel Reservation"}
              </button>
              <button
                onClick={() => setModal(null)}
                className="px-4 py-2 text-slate-600 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
