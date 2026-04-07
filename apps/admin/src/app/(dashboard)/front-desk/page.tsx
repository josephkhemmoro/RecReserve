"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAdminClub } from "@/lib/useAdminClub";
import { PageHeader, Card, Button, Badge, FormInput, EmptyState, Skeleton } from "@/components/ui";

interface TodayReservation {
  id: string; start_time: string; end_time: string; status: string;
  court_name: string; player_name: string; player_email: string; player_id: string;
  amount_paid: number; guest_count: number; checked_in: boolean;
}

interface MemberSearchResult {
  id: string; full_name: string; email: string; phone: string | null;
  tier_name: string | null; status: string | null;
}

export default function FrontDeskPage() {
  const { admin, loading: adminLoading } = useAdminClub();
  const [reservations, setReservations] = useState<TodayReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<MemberSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);

  const fetchToday = useCallback(async () => {
    if (!admin?.clubId) return;
    try {
      const supabase = createClient();
      const today = new Date();
      const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const dayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

      const { data } = await supabase.from("reservations")
        .select("id, start_time, end_time, status, amount_paid, guest_count, court:courts(name), user:users!reservations_user_id_fkey(id, full_name, email)")
        .eq("club_id", admin.clubId).gte("start_time", dayStart).lt("start_time", dayEnd)
        .in("status", ["confirmed", "completed"]).order("start_time");

      // Get check-in status
      const resIds = (data ?? []).map((r: Record<string, unknown>) => r.id as string);
      let checkedInSet = new Set<string>();
      if (resIds.length > 0) {
        const { data: checkins } = await supabase.from("reservation_checkins").select("reservation_id").in("reservation_id", resIds);
        for (const c of checkins ?? []) checkedInSet.add(c.reservation_id as string);
      }

      setReservations((data ?? []).map((r: Record<string, unknown>) => {
        const court = r.court as { name: string } | null;
        const user = r.user as { id: string; full_name: string; email: string } | null;
        return {
          id: r.id as string, start_time: r.start_time as string, end_time: r.end_time as string,
          status: r.status as string, court_name: court?.name ?? "\u2014", player_name: user?.full_name ?? "\u2014",
          player_email: user?.email ?? "", player_id: user?.id ?? "",
          amount_paid: Number(r.amount_paid) || 0, guest_count: Number(r.guest_count) || 0,
          checked_in: checkedInSet.has(r.id as string),
        };
      }));
    } catch (err) { console.error("Error fetching today:", err); }
    finally { setLoading(false); }
  }, [admin?.clubId]);

  useEffect(() => { fetchToday(); }, [fetchToday]);

  const handleSearch = async () => {
    if (!admin?.clubId || !search.trim()) return;
    setSearching(true);
    try {
      const supabase = createClient();
      const term = search.trim().toLowerCase();
      const { data } = await supabase.from("memberships")
        .select("user:users!memberships_user_id_fkey(id, full_name, email, phone), status, membership_tier:membership_tiers(name)")
        .eq("club_id", admin.clubId).eq("is_active", true);

      const results = (data ?? []).filter((m: Record<string, unknown>) => {
        const user = m.user as { full_name: string; email: string } | null;
        return user?.full_name?.toLowerCase().includes(term) || user?.email?.toLowerCase().includes(term);
      }).map((m: Record<string, unknown>) => {
        const user = m.user as { id: string; full_name: string; email: string; phone: string | null };
        const tier = m.membership_tier as { name: string } | null;
        return { id: user.id, full_name: user.full_name, email: user.email, phone: user.phone, tier_name: tier?.name ?? null, status: m.status as string | null };
      });
      setSearchResults(results);
    } catch (err) { console.error("Error searching:", err); }
    finally { setSearching(false); }
  };

  const handleCheckIn = async (reservation: TodayReservation) => {
    if (!admin?.userId) return;
    setCheckingIn(reservation.id);
    try {
      const supabase = createClient();
      await supabase.from("reservation_checkins").insert({
        reservation_id: reservation.id, user_id: reservation.player_id,
        checked_in_by: admin.userId, method: "manual",
      });
      await supabase.from("audit_logs").insert({
        club_id: admin.clubId, actor_id: admin.userId, actor_role: "front_desk",
        action: "reservation.check_in", entity_type: "reservation", entity_id: reservation.id,
      });
      fetchToday();
    } catch (err) { console.error("Error checking in:", err); }
    finally { setCheckingIn(null); }
  };

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const isLoading = adminLoading || loading;
  const now = new Date();
  const upcoming = reservations.filter((r) => new Date(r.start_time) > now);
  const current = reservations.filter((r) => new Date(r.start_time) <= now && new Date(r.end_time) > now);
  const past = reservations.filter((r) => new Date(r.end_time) <= now);

  return (
    <div>
      <PageHeader title="Front Desk" />

      {/* Member Lookup */}
      <Card title="Member Lookup" className="mb-6">
        <div className="flex gap-3">
          <FormInput value={search} onChange={setSearch} placeholder="Search by name or email..." className="flex-1" onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && handleSearch()} />
          <Button onClick={handleSearch} disabled={searching}>{searching ? "Searching..." : "Search"}</Button>
        </div>
        {searchResults.length > 0 && (
          <div className="mt-4 space-y-2">
            {searchResults.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                <div>
                  <p className="text-sm font-medium text-slate-900">{m.full_name}</p>
                  <p className="text-xs text-slate-500">{m.email}{m.phone ? ` \u00b7 ${m.phone}` : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  {m.tier_name && <Badge label={m.tier_name} variant="brand" />}
                  <Badge label={m.status || "active"} variant={m.status === "active" ? "success" : "warning"} />
                  <Button variant="ghost" size="sm" onClick={() => window.location.href = `/members/${m.id}`}>View</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Current Sessions */}
      {current.length > 0 && (
        <Card title={`On Court Now (${current.length})`} className="mb-6" noPadding>
          <table className="w-full">
            <tbody>
              {current.map((r) => (
                <tr key={r.id} className="border-b border-slate-50">
                  <td className="px-6 py-3 text-sm font-medium text-slate-900">{r.player_name}</td>
                  <td className="px-6 py-3 text-sm text-slate-600">{r.court_name}</td>
                  <td className="px-6 py-3 text-sm text-slate-600">{formatTime(r.start_time)} - {formatTime(r.end_time)}</td>
                  <td className="px-6 py-3 text-right">
                    {r.checked_in ? <Badge label="Checked In" variant="success" /> : (
                      <Button size="sm" onClick={() => handleCheckIn(r)} disabled={checkingIn === r.id}>
                        {checkingIn === r.id ? "..." : "Check In"}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Upcoming */}
      <Card title={`Upcoming Today (${upcoming.length})`} noPadding className="mb-6">
        {isLoading ? (<div className="p-6 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>)
        : upcoming.length === 0 ? (<EmptyState title="No upcoming reservations" description="All done for today." />)
        : (
          <table className="w-full">
            <thead><tr className="border-b border-slate-100">
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Player</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Court</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Guests</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Check In</th>
            </tr></thead>
            <tbody>
              {upcoming.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-6 py-3 text-sm font-medium text-slate-900">{r.player_name}</td>
                  <td className="px-6 py-3 text-sm text-slate-600">{r.court_name}</td>
                  <td className="px-6 py-3 text-sm text-slate-600">{formatTime(r.start_time)} - {formatTime(r.end_time)}</td>
                  <td className="px-6 py-3 text-sm text-slate-600">{r.guest_count > 0 ? r.guest_count : "\u2014"}</td>
                  <td className="px-6 py-3 text-right">
                    {r.checked_in ? <Badge label="Checked In" variant="success" /> : (
                      <Button size="sm" onClick={() => handleCheckIn(r)} disabled={checkingIn === r.id}>
                        {checkingIn === r.id ? "..." : "Check In"}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Completed */}
      {past.length > 0 && (
        <Card title={`Completed (${past.length})`} noPadding>
          <table className="w-full">
            <tbody>
              {past.map((r) => (
                <tr key={r.id} className="border-b border-slate-50">
                  <td className="px-6 py-3 text-sm text-slate-500">{r.player_name}</td>
                  <td className="px-6 py-3 text-sm text-slate-500">{r.court_name}</td>
                  <td className="px-6 py-3 text-sm text-slate-500">{formatTime(r.start_time)} - {formatTime(r.end_time)}</td>
                  <td className="px-6 py-3 text-right">{r.checked_in ? <Badge label="Attended" variant="success" /> : <Badge label="No Check-In" variant="default" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
