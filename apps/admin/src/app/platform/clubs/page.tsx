"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Search, Building2, ExternalLink } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Card, PageHeader, Badge, Button, EmptyState, SkeletonTableRow } from "@/components/ui";
import { useConfirm, usePrompt } from "@/components/ui/Dialog";

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
  const confirm = useConfirm();
  const prompt = usePrompt();

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
      toast.success(`${newStatus === "active" ? "Reactivated" : newStatus === "suspended" ? "Suspended" : "Archived"} successfully`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update club");
    } finally {
      setBusy(null);
    }
  };

  const handleSuspend = async (club: ClubRow) => {
    const reason = await prompt({
      title: `Suspend ${club.name}?`,
      description: "Players won't be able to make new bookings or memberships. Existing reservations are honored.",
      placeholder: "Reason (optional)",
      confirmLabel: "Suspend Club",
      cancelLabel: "Cancel",
      tone: "warning",
      multiline: true,
    });
    if (reason === null) return;
    await handleStatusChange(club.id, "suspended", reason || undefined);
  };

  const handleReactivate = async (club: ClubRow) => {
    const ok = await confirm({
      title: `Reactivate ${club.name}?`,
      description: "New bookings and memberships will be allowed again.",
      confirmLabel: "Reactivate",
    });
    if (!ok) return;
    await handleStatusChange(club.id, "active");
  };

  const handleArchive = async (club: ClubRow) => {
    const upcomingNote = club.upcoming_reservations > 0
      ? `${club.upcoming_reservations} upcoming reservation${club.upcoming_reservations > 1 ? "s" : ""} will NOT be auto-cancelled. Refund them first if needed.`
      : "No upcoming reservations to worry about.";
    const confirmation = await prompt({
      title: `Archive ${club.name}?`,
      description: `Permanent offboarding. New bookings + memberships blocked. Historical data preserved. ${upcomingNote}`,
      placeholder: 'Type "archive" to confirm',
      requireTypedConfirmation: "archive",
      confirmLabel: "Archive Club",
      tone: "danger",
    });
    if (confirmation === null) return;
    const reason = await prompt({
      title: "Archive reason",
      description: "Optional — for the audit log.",
      placeholder: "e.g. left platform, non-payment",
      confirmLabel: "Save & Archive",
      tone: "danger",
      multiline: true,
    });
    if (reason === null) return;
    await handleStatusChange(club.id, "archived", reason || undefined);
  };

  const filtered = clubs.filter((c) => {
    if (statusFilter !== "all" && c.platform_status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return c.name.toLowerCase().includes(q) || (c.location || "").toLowerCase().includes(q);
    }
    return true;
  });

  const counts = {
    all: clubs.length,
    active: clubs.filter((c) => c.platform_status === "active").length,
    suspended: clubs.filter((c) => c.platform_status === "suspended").length,
    archived: clubs.filter((c) => c.platform_status === "archived").length,
  };

  return (
    <div>
      <PageHeader
        eyebrow="Platform"
        title="Clubs"
        subtitle={`${counts.all} total · ${counts.active} active${counts.suspended ? ` · ${counts.suspended} suspended` : ""}${counts.archived ? ` · ${counts.archived} archived` : ""}`}
        action={
          <Link href="/platform/clubs/new">
            <Button variant="primary" icon={<Plus />}>New Club</Button>
          </Link>
        }
      />

      <Card noPadding>
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name or location"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand transition-all"
            />
          </div>
          <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
            {(["all", "active", "suspended", "archived"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  statusFilter === s
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
                <span className="ml-1.5 text-[10px] tabular-nums opacity-60">{counts[s]}</span>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="px-6 py-3 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonTableRow key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Building2 />}
            title={clubs.length === 0 ? "No clubs yet" : "No matching clubs"}
            description={clubs.length === 0 ? "Onboard your first club to start accepting bookings." : "Try a different search or filter."}
            action={clubs.length === 0 ? <Link href="/platform/clubs/new"><Button variant="primary" icon={<Plus />}>Create First Club</Button></Link> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100 bg-slate-50/40">
                  <th className="py-3 px-6">Club</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4">Stripe</th>
                  <th className="py-3 pr-4">Members</th>
                  <th className="py-3 pr-4">GMV <span className="text-slate-400 normal-case font-medium">(30d)</span></th>
                  <th className="py-3 pr-4">Upcoming</th>
                  <th className="py-3 pr-4">Created</th>
                  <th className="py-3 pr-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-6">
                      <Link href={`/platform/clubs/${c.id}`} className="font-semibold text-slate-900 hover:text-brand inline-flex items-center gap-1.5 group">
                        {c.name}
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                      {c.location && <p className="text-xs text-slate-500 mt-0.5">{c.location}</p>}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge
                        label={c.platform_status}
                        dot
                        variant={c.platform_status === "active" ? "success" : c.platform_status === "suspended" ? "warning" : "default"}
                      />
                    </td>
                    <td className="py-3 pr-4">
                      {c.stripe_onboarding_complete
                        ? <Badge label="Connected" variant="success" dot />
                        : <Badge label="Pending" variant="default" />}
                    </td>
                    <td className="py-3 pr-4 text-slate-700 tabular-nums font-medium">{c.member_count}</td>
                    <td className="py-3 pr-4 text-slate-700 tabular-nums font-medium">{formatUsd(c.gmv_30d_cents)}</td>
                    <td className="py-3 pr-4 text-slate-700 tabular-nums">{c.upcoming_reservations}</td>
                    <td className="py-3 pr-4 text-slate-500 text-xs">{new Date(c.created_at).toLocaleDateString()}</td>
                    <td className="py-3 pr-6 text-right">
                      <div className="flex gap-1.5 justify-end">
                        {c.platform_status === "active" && (
                          <>
                            <button onClick={() => handleSuspend(c)} disabled={busy === c.id} className="text-xs px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:opacity-50 font-semibold transition-colors ring-1 ring-amber-200">Suspend</button>
                            <button onClick={() => handleArchive(c)} disabled={busy === c.id} className="text-xs px-2.5 py-1 rounded-md bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:opacity-50 font-semibold transition-colors ring-1 ring-slate-200">Archive</button>
                          </>
                        )}
                        {c.platform_status === "suspended" && (
                          <>
                            <button onClick={() => handleReactivate(c)} disabled={busy === c.id} className="text-xs px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 font-semibold transition-colors ring-1 ring-emerald-200">Reactivate</button>
                            <button onClick={() => handleArchive(c)} disabled={busy === c.id} className="text-xs px-2.5 py-1 rounded-md bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:opacity-50 font-semibold transition-colors ring-1 ring-slate-200">Archive</button>
                          </>
                        )}
                        {c.platform_status === "archived" && (
                          <span className="text-xs text-slate-400 italic">No actions</span>
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
