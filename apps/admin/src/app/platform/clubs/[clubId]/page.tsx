"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Users, CalendarDays, DollarSign, TrendingUp, Building2, ExternalLink } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Card, PageHeader, Button, Badge, StatCard, FormInput } from "@/components/ui";
import { useConfirm, usePrompt } from "@/components/ui/Dialog";

interface ClubDetail {
  id: string;
  name: string;
  location: string | null;
  phone: string | null;
  website: string | null;
  description: string | null;
  platform_status: "active" | "suspended" | "archived";
  platform_status_reason: string | null;
  platform_status_changed_at: string | null;
  archived_at: string | null;
  stripe_account_id: string | null;
  stripe_onboarding_complete: boolean | null;
  requires_paid_membership: boolean | null;
  created_at: string;
}

interface AdminRow {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
}

interface PaymentRow {
  id: string;
  amount_cents: number;
  platform_fee_cents: number;
  status: string;
  stripe_payment_intent_id: string | null;
  created_at: string;
  user_id: string;
  entity_type: string;
}

function formatUsd(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function ClubDetailPage() {
  const params = useParams();
  const clubId = params.clubId as string;

  const [club, setClub] = useState<ClubDetail | null>(null);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [stats, setStats] = useState({ members: 0, reservations30d: 0, gmv30dCents: 0, feesAllTimeCents: 0, upcoming: 0 });
  const [recentPayments, setRecentPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [promoteEmail, setPromoteEmail] = useState("");
  const confirm = useConfirm();
  const prompt = usePrompt();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();

    const [
      clubRes,
      adminsRes,
      memRes,
      reservationsRes,
      gmvRes,
      feesRes,
      upcomingRes,
      paymentsRes,
    ] = await Promise.all([
      supabase.from("clubs").select("*").eq("id", clubId).single(),
      supabase.from("users").select("id, email, full_name, role").eq("club_id", clubId).in("role", ["admin", "owner", "club_admin", "manager"]),
      supabase.from("memberships").select("id", { count: "exact", head: true }).eq("club_id", clubId).eq("is_active", true),
      supabase.from("reservations").select("id", { count: "exact", head: true }).eq("club_id", clubId).gte("created_at", thirtyDaysAgo),
      supabase.from("payment_records").select("amount_cents").eq("club_id", clubId).eq("status", "succeeded").gte("created_at", thirtyDaysAgo),
      supabase.from("payment_records").select("platform_fee_cents").eq("club_id", clubId).eq("status", "succeeded"),
      supabase.from("reservations").select("id", { count: "exact", head: true }).eq("club_id", clubId).eq("status", "confirmed").gte("start_time", nowIso),
      supabase.from("payment_records").select("*").eq("club_id", clubId).order("created_at", { ascending: false }).limit(20),
    ]);

    if (clubRes.error || !clubRes.data) {
      setClub(null);
      setLoading(false);
      return;
    }
    setClub(clubRes.data as ClubDetail);
    setAdmins((adminsRes.data || []) as AdminRow[]);
    setStats({
      members: memRes.count || 0,
      reservations30d: reservationsRes.count || 0,
      gmv30dCents: (gmvRes.data || []).reduce((s, p) => s + (p.amount_cents || 0), 0),
      feesAllTimeCents: (feesRes.data || []).reduce((s, p) => s + (p.platform_fee_cents || 0), 0),
      upcoming: upcomingRes.count || 0,
    });
    setRecentPayments((paymentsRes.data || []) as PaymentRow[]);
    setLoading(false);
  }, [clubId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateStatus = async (newStatus: ClubDetail["platform_status"], reason?: string) => {
    if (!club) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const update: Record<string, unknown> = {
        platform_status: newStatus,
        platform_status_changed_at: new Date().toISOString(),
        platform_status_reason: reason || null,
      };
      if (newStatus === "archived") update.archived_at = new Date().toISOString();
      const { error } = await supabase.from("clubs").update(update).eq("id", club.id);
      if (error) throw error;

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.from("audit_logs").insert({
          club_id: club.id, actor_id: session.user.id,
          action: `club.${newStatus}`, entity_type: "club", entity_id: club.id,
          changes: { platform_status: { old: club.platform_status, new: newStatus }, reason: reason || null },
        }).catch(() => {});
      }
      await fetchData();
      toast.success(
        newStatus === "active" ? "Club reactivated" : newStatus === "suspended" ? "Club suspended" : "Club archived"
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const handleSuspend = async () => {
    if (!club) return;
    const reason = await prompt({
      title: `Suspend ${club.name}?`,
      description: "Players won't be able to make new bookings or memberships. Existing reservations are honored.",
      placeholder: "Reason (optional)",
      confirmLabel: "Suspend Club",
      tone: "warning",
      multiline: true,
    });
    if (reason === null) return;
    await updateStatus("suspended", reason || undefined);
  };

  const handleReactivate = async () => {
    if (!club) return;
    const ok = await confirm({
      title: `Reactivate ${club.name}?`,
      description: "New bookings and memberships will be allowed again.",
      confirmLabel: "Reactivate",
    });
    if (!ok) return;
    await updateStatus("active");
  };

  const handleArchive = async () => {
    if (!club) return;
    const upcomingNote = stats.upcoming > 0
      ? `${stats.upcoming} upcoming reservation${stats.upcoming > 1 ? "s" : ""} will NOT be auto-cancelled. Refund them first if needed.`
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
    await updateStatus("archived", reason || undefined);
  };

  const handlePromote = async () => {
    if (!club || !promoteEmail.trim()) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const email = promoteEmail.trim().toLowerCase();
      const { data: user, error: lookupError } = await supabase
        .from("users")
        .select("id, full_name, club_id")
        .eq("email", email)
        .maybeSingle();

      if (lookupError) throw lookupError;
      if (!user) {
        toast.error(`No account found for ${email}`, {
          description: "They need to sign up at /login first, then you can promote them.",
        });
        return;
      }

      const { error: updateError } = await supabase
        .from("users")
        .update({ club_id: club.id, role: "admin" })
        .eq("id", user.id);
      if (updateError) throw updateError;

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.from("audit_logs").insert({
          club_id: club.id, actor_id: session.user.id,
          action: "club.admin_assigned", entity_type: "user", entity_id: user.id,
          changes: { email: { new: email }, club_id: { new: club.id } },
        }).catch(() => {});
      }
      setPromoteEmail("");
      toast.success(`${user.full_name || email} is now an admin`, {
        description: `They can sign in and manage ${club.name}.`,
      });
      await fetchData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to promote user");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div>
        <div className="h-9 w-48 animate-shimmer rounded-lg mb-3" />
        <div className="h-5 w-72 animate-shimmer rounded-md mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-shimmer rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="h-14 w-14 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 mb-4">
          <Building2 className="h-6 w-6" />
        </div>
        <p className="text-base font-semibold text-slate-900 mb-1">Club not found</p>
        <p className="text-sm text-slate-500 mb-5">It may have been deleted or you don&apos;t have access.</p>
        <Link href="/platform/clubs"><Button variant="secondary" icon={<ArrowLeft />}>Back to Clubs</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={club.name}
        subtitle={[club.location, `Created ${new Date(club.created_at).toLocaleDateString()}`].filter(Boolean).join(" · ")}
        action={
          <div className="flex gap-2">
            {club.platform_status === "active" && (
              <>
                <Button variant="secondary" onClick={handleSuspend} disabled={busy}>Suspend</Button>
                <Button variant="ghost" onClick={handleArchive} disabled={busy}>Archive</Button>
              </>
            )}
            {club.platform_status === "suspended" && (
              <>
                <Button variant="primary" onClick={handleReactivate} disabled={busy}>Reactivate</Button>
                <Button variant="ghost" onClick={handleArchive} disabled={busy}>Archive</Button>
              </>
            )}
            {club.platform_status === "archived" && (
              <Badge label="Archived" variant="default" />
            )}
          </div>
        }
      />

      {club.platform_status !== "active" && (
        <div className={`p-4 rounded-lg border ${club.platform_status === "suspended" ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-slate-100 border-slate-200 text-slate-700"}`}>
          <p className="text-sm font-semibold capitalize">{club.platform_status}</p>
          {club.platform_status_reason && <p className="text-xs mt-1">Reason: {club.platform_status_reason}</p>}
          {club.platform_status_changed_at && <p className="text-xs mt-1">Since: {new Date(club.platform_status_changed_at).toLocaleString()}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Members" value={String(stats.members)} icon={<Users />} accent="brand" />
        <StatCard label="Reservations (30d)" value={String(stats.reservations30d)} icon={<CalendarDays />} />
        <StatCard label="GMV (30d)" value={formatUsd(stats.gmv30dCents)} icon={<DollarSign />} accent="success" />
        <StatCard label="Platform Fees Earned" value={formatUsd(stats.feesAllTimeCents)} icon={<TrendingUp />} accent="success" />
      </div>

      <Card>
        <h2 className="text-base font-semibold text-slate-900 mb-3">Stripe Connect</h2>
        <div className="flex items-center gap-3">
          {club.stripe_onboarding_complete ? (
            <Badge label="Connected & verified" variant="success" />
          ) : club.stripe_account_id ? (
            <Badge label="Pending verification" variant="warning" />
          ) : (
            <Badge label="Not connected" variant="default" />
          )}
          {club.stripe_account_id && (
            <a
              href={`https://dashboard.stripe.com/connect/accounts/${club.stripe_account_id}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-teal-600 hover:text-teal-700 font-medium"
            >
              View in Stripe →
            </a>
          )}
        </div>
        {!club.stripe_onboarding_complete && (
          <p className="text-xs text-slate-500 mt-2">
            Until Stripe is connected, payments go to the platform account (you). Have the club admin click the Stripe banner in their dashboard to onboard.
          </p>
        )}
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-slate-900 mb-3">Admins ({admins.length})</h2>
        {admins.length === 0 ? (
          <p className="text-sm text-slate-500 mb-4">No admin assigned yet. Use the form below to promote a user once they&apos;ve signed up.</p>
        ) : (
          <div className="space-y-2 mb-4">
            {admins.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-2 rounded bg-slate-50">
                <div>
                  <p className="text-sm font-medium text-slate-900">{a.full_name || "(no name)"}</p>
                  <p className="text-xs text-slate-500">{a.email} · {a.role}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-3 border-t border-slate-100 space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">Promote a user to admin</h3>
          <p className="text-xs text-slate-500">User must already have signed up at /login.</p>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <FormInput label="Email" value={promoteEmail} onChange={setPromoteEmail} placeholder="user@example.com" />
            </div>
            <Button variant="primary" onClick={handlePromote} disabled={busy || !promoteEmail.includes("@")}>
              Promote
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-slate-900 mb-3">Recent Payments</h2>
        {recentPayments.length === 0 ? (
          <p className="text-sm text-slate-500">No payments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Platform Fee</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Stripe</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50">
                    <td className="py-2 pr-4 text-slate-600">{new Date(p.created_at).toLocaleString()}</td>
                    <td className="py-2 pr-4 text-slate-700">{p.entity_type}</td>
                    <td className="py-2 pr-4 text-slate-900 font-medium">{formatUsd(p.amount_cents)}</td>
                    <td className="py-2 pr-4 text-slate-700">{formatUsd(p.platform_fee_cents || 0)}</td>
                    <td className="py-2 pr-4">
                      <Badge
                        label={p.status}
                        variant={p.status === "succeeded" ? "success" : p.status === "refunded" || p.status === "partially_refunded" ? "warning" : p.status === "failed" || p.status === "disputed" ? "error" : "default"}
                      />
                    </td>
                    <td className="py-2 pr-4">
                      {p.stripe_payment_intent_id && (
                        <a href={`https://dashboard.stripe.com/payments/${p.stripe_payment_intent_id}`} target="_blank" rel="noreferrer" className="text-xs text-teal-600 hover:text-teal-700">View →</a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div>
        <Link href="/platform/clubs" className="text-sm text-slate-500 hover:text-slate-700">← Back to all clubs</Link>
      </div>
    </div>
  );
}
