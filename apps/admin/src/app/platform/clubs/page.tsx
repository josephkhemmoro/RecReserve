"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { Card, PageHeader, Badge, Button, EmptyState, SkeletonTableRow } from "@/components/ui";

type Status = "active" | "suspended" | "archived";

interface ClubRow {
  id: string;
  name: string;
  location: string | null;
  platform_status: Status;
  stripe_onboarding_complete: boolean | null;
  created_at: string;
  member_count: number;
  gmv_30d_cents: number;
  upcoming_reservations: number;
}

function formatUsd(cents: number): string {
  if (!cents) return "$0";
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function ClubsListPage() {
  const [clubs, setClubs] = useState<ClubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [busy, setBusy] = useState<string | null>(null);

  const fetchClubs = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();

    const { data: rows } = await supabase
      .from("clubs")
      .select("id, name, location, platform_status, stripe_onboarding_complete, created_at")
      .order("created_at", { ascending: false });

    const enriched: ClubRow[] = await Promise.all(
      (rows || []).map(async (c) => {
        const [memRes, gmvRes, upcomingRes] = await Promise.all([
          supabase.from("memberships").select("id", { count: "exact", head: true }).eq("club_id", c.id).eq("is_active", true),
          supabase.from("payment_records").select("amount_cents").eq("club_id", c.id).eq("status", "succeeded").gte("created_at", thirtyDaysAgo),
          supabase.from("reservations").select("id", { count: "exact", head: true }).eq("club_id", c.id).eq("status", "confirmed").gte("start_time", nowIso),
        ]);
        return {
          id: c.id,
          name: c.name,
          location: c.location,
          platform_status: (c.platform_status as Status) || "active",
          stripe_onboarding_complete: c.stripe_onboarding_complete,
          created_at: c.created_at,
          member_count: memRes.count || 0,
          gmv_30d_cents: (gmvRes.data || []).reduce((s, p) => s + (p.amount_cents || 0), 0),
          upcoming_reservations: upcomingRes.count || 0,
        };
      })
    );
    setClubs(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { fetchClubs(); }, [fetchClubs]);

  const handleStatusChange = async (clubId: string, newStatus: Status, reason?: string) => {
    setBusy(clubId);
    try {
      const supabase = createClient();
      const update: Record<string, unknown> = {
        platform_status: newStatus,
        platform_status_changed_at: new Date().toISOString(),
        platform_status_reason: reason || null,
      };
      if (newStatus === "archived") update.archived_at = new Date().toISOString();
      const { error } = await supabase.from("clubs").update(update).eq("id", clubId);
      if (error) throw error;
      // Audit
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.from("audit_logs").insert({
          club_id: clubId,
          actor_id: session.user.id,
          action: `club.${newStatus}`,
          entity_type: "club",
          entity_id: clubId,
          changes: { platform_status: { new: newStatus }, reason: reason || null },
        }).catch(() => {});
      }
      await fetchClubs();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update";
      alert(message);
    } finally {
      setBusy(null);
    }
  };

  const handleSuspend = (club: ClubRow) => {
    const reason = prompt(`Suspend "${club.name}"? Players won't be able to make new bookings or memberships. Existing reservations are honored.\n\nReason (optional):`);
    if (reason === null) return;
    handleStatusChange(club.id, "suspended", reason || undefined);
  };

  const handleReactivate = (club: ClubRow) => {
    if (!confirm(`Reactivate "${club.name}"? New bookings and memberships will be allowed again.`)) return;
    handleStatusChange(club.id, "active");
  };

  const handleArchive = (club: ClubRow) => {
    const message = `ARCHIVE "${club.name}"?\n\nThis is offboarding. The club will be permanently removed from active operations:\n  • All new bookings + memberships blocked\n  • Club admin login still works (read-only access)\n  • Historical data preserved\n  • ${club.upcoming_reservations} upcoming reservation(s) will NOT be auto-cancelled\n\nIf upcoming reservations need refunds, do that BEFORE archiving.\n\nType "archive" to confirm:`;
    const confirmation = prompt(message);
    if (confirmation !== "archive") return;
    const reason = prompt("Archive reason (e.g. 'left platform', 'non-payment'):");
    handleStatusChange(club.id, "archived", reason || undefined);
  };

  const filtered = clubs.filter((c) => {
    if (statusFilter !== "all" && c.platform_status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return c.name.toLowerCase().includes(q) || (c.location || "").toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div>
      <PageHeader
        title="Clubs"
        subtitle={`${clubs.length} total clubs · ${clubs.filter((c) => c.platform_status === "active").length} active`}
        action={
          <Link href="/platform/clubs/new">
            <Button variant="primary">+ New Club</Button>
          </Link>
        }
      />

      <Card>
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by name or location"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>
          <div className="flex gap-2">
            {(["all", "active", "suspended", "archived"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === s ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonTableRow key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={clubs.length === 0 ? "No clubs yet" : "No matching clubs"}
            description={clubs.length === 0 ? "Onboard your first club to start accepting bookings." : "Try a different search or filter."}
            action={clubs.length === 0 ? <Link href="/platform/clubs/new"><Button variant="primary">+ Create First Club</Button></Link> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  <th className="py-2 pr-4">Club</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Stripe</th>
                  <th className="py-2 pr-4">Members</th>
                  <th className="py-2 pr-4">GMV (30d)</th>
                  <th className="py-2 pr-4">Upcoming</th>
                  <th className="py-2 pr-4">Created</th>
                  <th className="py-2 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-3 pr-4">
                      <Link href={`/platform/clubs/${c.id}`} className="font-medium text-slate-900 hover:text-teal-600">{c.name}</Link>
                      {c.location && <p className="text-xs text-slate-500">{c.location}</p>}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge
                        label={c.platform_status}
                        variant={c.platform_status === "active" ? "success" : c.platform_status === "suspended" ? "warning" : "default"}
                      />
                    </td>
                    <td className="py-3 pr-4">
                      {c.stripe_onboarding_complete
                        ? <Badge label="Connected" variant="success" />
                        : <Badge label="Not connected" variant="default" />}
                    </td>
                    <td className="py-3 pr-4 text-slate-700">{c.member_count}</td>
                    <td className="py-3 pr-4 text-slate-700">{formatUsd(c.gmv_30d_cents)}</td>
                    <td className="py-3 pr-4 text-slate-700">{c.upcoming_reservations}</td>
                    <td className="py-3 pr-4 text-slate-500">{new Date(c.created_at).toLocaleDateString()}</td>
                    <td className="py-3 pr-4 text-right">
                      <div className="flex gap-1.5 justify-end">
                        {c.platform_status === "active" && (
                          <>
                            <button onClick={() => handleSuspend(c)} disabled={busy === c.id} className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50">Suspend</button>
                            <button onClick={() => handleArchive(c)} disabled={busy === c.id} className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50">Archive</button>
                          </>
                        )}
                        {c.platform_status === "suspended" && (
                          <>
                            <button onClick={() => handleReactivate(c)} disabled={busy === c.id} className="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">Reactivate</button>
                            <button onClick={() => handleArchive(c)} disabled={busy === c.id} className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-50">Archive</button>
                          </>
                        )}
                        {c.platform_status === "archived" && (
                          <span className="text-xs text-slate-400">Archived</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
