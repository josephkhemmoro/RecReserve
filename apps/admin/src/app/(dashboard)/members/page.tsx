"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAdminClub } from "@/lib/useAdminClub";
import { PageHeader, Card, Badge, Button, Modal, FormInput, EmptyState, SkeletonTableRow } from "@/components/ui";

interface MembershipTier {
  id: string;
  name: string;
  color: string | null;
}

interface Member {
  id: string;
  full_name: string;
  email: string;
  role: string;
  created_at: string;
  membership: {
    id: string;
    tier_id: string | null;
    tier_name: string | null;
    tier_color: string | null;
    is_active: boolean;
    status: string | null;
    guest_allowance: number | null;
    renewal_date: string | null;
    stripe_subscription_id: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
  } | null;
}

function formatPeriodEnd(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function MembersPage() {
  const { admin, loading: adminLoading } = useAdminClub();
  const [members, setMembers] = useState<Member[]>([]);
  const [tiers, setTiers] = useState<MembershipTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [creditModal, setCreditModal] = useState<{ userId: string; name: string } | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [savingCredit, setSavingCredit] = useState(false);

  const fetchTiers = useCallback(async (clubId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("membership_tiers")
      .select("id, name, color")
      .eq("club_id", clubId)
      .order("created_at", { ascending: true });
    setTiers(data ?? []);
  }, []);

  const fetchMembers = useCallback(async (clubId: string) => {
    try {
      const supabase = createClient();
      const memberMap = new Map<string, Member>();

      const { data: memberships, error: membershipsError } = await supabase
        .from("memberships")
        .select(`
          id,
          user_id,
          tier_id,
          is_active,
          status,
          guest_allowance,
          renewal_date,
          stripe_subscription_id,
          current_period_end,
          cancel_at_period_end,
          membership_tier:membership_tiers!tier_id(name, color),
          user:users!memberships_user_id_fkey(id, full_name, email, role, created_at)
        `)
        .eq("club_id", clubId);

      if (membershipsError) throw membershipsError;

      for (const m of memberships ?? []) {
        const user = m.user as {
          id: string;
          full_name: string;
          email: string;
          role: string;
          created_at: string;
        } | null;
        if (!user) continue;

        const tier = m.membership_tier as { name: string; color: string | null } | null;
        memberMap.set(user.id, {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          created_at: user.created_at,
          membership: {
            id: m.id as string,
            tier_id: m.tier_id as string | null,
            tier_name: tier?.name ?? null,
            tier_color: tier?.color ?? null,
            is_active: m.is_active as boolean,
            status: (m.status as string) ?? null,
            guest_allowance: (m.guest_allowance as number) ?? null,
            renewal_date: (m.renewal_date as string) ?? null,
            stripe_subscription_id: (m.stripe_subscription_id as string) ?? null,
            current_period_end: (m.current_period_end as string) ?? null,
            cancel_at_period_end: !!m.cancel_at_period_end,
          },
        });
      }

      const { data: legacyUsers, error: usersError } = await supabase
        .from("users")
        .select("id, full_name, email, role, created_at")
        .eq("club_id", clubId)
        .order("full_name");

      if (usersError) throw usersError;

      for (const u of legacyUsers ?? []) {
        if (memberMap.has(u.id as string)) continue;

        memberMap.set(u.id as string, {
          id: u.id as string,
          full_name: u.full_name as string,
          email: u.email as string,
          role: u.role as string,
          created_at: u.created_at as string,
          membership: null,
        });
      }

      setMembers(
        Array.from(memberMap.values()).sort((a, b) =>
          a.full_name.localeCompare(b.full_name)
        )
      );
    } catch (err) {
      console.error("Error fetching members:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (admin?.clubId) {
      fetchTiers(admin.clubId);
      fetchMembers(admin.clubId);
    }
  }, [admin?.clubId, fetchTiers, fetchMembers]);

  useEffect(() => {
    if (!admin?.clubId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`members-page-${admin.clubId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "memberships",
          filter: `club_id=eq.${admin.clubId}`,
        },
        () => {
          fetchMembers(admin.clubId);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "users",
          filter: `club_id=eq.${admin.clubId}`,
        },
        () => {
          fetchMembers(admin.clubId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [admin?.clubId, fetchMembers]);

  const handleMembershipChange = async (member: Member, tierId: string) => {
    if (!admin?.clubId) return;
    // Subscribed members can only change tier via the mobile app flow
    if (member.membership?.stripe_subscription_id) return;
    try {
      const supabase = createClient();
      let result;
      if (tierId === "") {
        // Remove membership
        if (member.membership) {
          result = await supabase
            .from("memberships")
            .delete()
            .eq("id", member.membership.id);
        }
      } else if (member.membership) {
        result = await supabase
          .from("memberships")
          .update({ tier_id: tierId })
          .eq("id", member.membership.id);
      } else {
        result = await supabase.from("memberships").insert({
          user_id: member.id,
          club_id: admin.clubId,
          tier_id: tierId,
          tier: "standard",
          start_date: new Date().toLocaleDateString("en-CA"),
          is_active: true,
        });
      }
      if (result?.error) {
        console.error("Supabase error updating membership:", result.error);
      }
      fetchMembers(admin.clubId);
    } catch (err) {
      console.error("Error updating membership:", err);
    }
  };

  const handleStatusChange = async (member: Member, newStatus: string) => {
    if (!member.membership || !admin?.clubId) return;
    try {
      const supabase = createClient();
      const updates: Record<string, unknown> = { status: newStatus };

      if (newStatus === "active") {
        updates.is_active = true;
        updates.suspended_at = null;
        updates.suspended_reason = null;
      } else if (newStatus === "suspended") {
        updates.is_active = false;
        updates.suspended_at = new Date().toISOString();
      } else if (newStatus === "cancelled") {
        updates.is_active = false;
        updates.cancelled_at = new Date().toISOString();
      }

      await supabase
        .from("memberships")
        .update(updates)
        .eq("id", member.membership.id);

      // Audit log
      await supabase.from("audit_logs").insert({
        club_id: admin.clubId,
        actor_id: admin.userId,
        actor_role: "admin",
        action: `membership.${newStatus === "active" ? "activate" : newStatus === "suspended" ? "suspend" : "cancel"}`,
        entity_type: "membership",
        entity_id: member.membership.id,
        changes: { status: { old: member.membership.status, new: newStatus } },
      });

      fetchMembers(admin.clubId);
    } catch (err) {
      console.error("Error changing membership status:", err);
    }
  };

  const handleAddCredit = async () => {
    if (!creditModal || !admin?.clubId || !creditAmount) return;
    const amount = parseFloat(creditAmount);
    if (isNaN(amount) || amount <= 0) return;
    setSavingCredit(true);
    try {
      const supabase = createClient();
      const { data: user } = await supabase
        .from("users")
        .select("credit_balance")
        .eq("id", creditModal.userId)
        .single();
      const current = Number(user?.credit_balance ?? 0);
      const { error } = await supabase
        .from("users")
        .update({ credit_balance: current + amount })
        .eq("id", creditModal.userId);
      if (error) throw error;
      setCreditModal(null);
      setCreditAmount("");
      fetchMembers(admin.clubId);
    } catch (err) {
      console.error("Error adding credit:", err);
    } finally {
      setSavingCredit(false);
    }
  };

  const filtered = members.filter(
    (m) =>
      m.full_name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())
  );

  const isLoading = adminLoading || loading;

  return (
    <div>
      <PageHeader
        title="Members"
        action={
          <input
            type="text"
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 w-64 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
          />
        }
      />

      <Card noPadding>
        {isLoading ? (
          <div className="py-3 space-y-1">
            {[1, 2, 3, 4].map((i) => <SkeletonTableRow key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={search ? "No members match your search" : "No members found"}
          />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Membership</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Joined</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const isSubscribed = !!m.membership?.stripe_subscription_id;
                const periodEnd = formatPeriodEnd(m.membership?.current_period_end ?? null);
                return (
                <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-6 py-3 text-sm font-medium text-slate-900">{m.full_name}</td>
                  <td className="px-6 py-3 text-sm text-slate-600">{m.email}</td>
                  <td className="px-6 py-3">
                    <Badge
                      label={m.role}
                      variant={m.role === "admin" || m.role === "owner" ? "brand" : "default"}
                      className="capitalize"
                    />
                  </td>
                  <td className="px-6 py-3">
                    {tiers.length > 0 ? (
                      <div className="relative group inline-block">
                        <select
                          value={m.membership?.tier_id ?? ""}
                          onChange={(e) => handleMembershipChange(m, e.target.value)}
                          disabled={isSubscribed}
                          className={`px-2 py-1 rounded border text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand ${
                            isSubscribed
                              ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed"
                              : "border-slate-300 text-slate-900"
                          }`}
                        >
                          <option value="">None</option>
                          {tiers.map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                        {isSubscribed && (
                          <div className="absolute bottom-full left-0 mb-1 px-2.5 py-1 bg-slate-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                            Member must cancel/upgrade from the app
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-slate-400">No memberships created</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-sm text-slate-600">
                    {new Date(m.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex flex-col gap-1 items-start">
                      <Badge
                        label={m.membership?.status === "trial" ? "Trial" : m.membership?.status === "suspended" ? "Suspended" : m.membership?.status === "cancelled" ? "Cancelled" : m.membership?.status === "expired" ? "Expired" : m.membership?.is_active !== false ? "Active" : "Inactive"}
                        variant={m.membership?.status === "active" ? "success" : m.membership?.status === "trial" ? "info" : m.membership?.status === "suspended" || m.membership?.status === "cancelled" ? "error" : m.membership?.status === "expired" ? "warning" : m.membership?.is_active !== false ? "success" : "error"}
                      />
                      {isSubscribed && (
                        <Badge
                          label={
                            m.membership?.cancel_at_period_end
                              ? `Cancelling ${periodEnd}`
                              : `Subscription active until ${periodEnd}`
                          }
                          variant={m.membership?.cancel_at_period_end ? "warning" : "brand"}
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3 text-right space-x-2">
                    {m.membership && (
                      <select
                        value={m.membership.status || "active"}
                        onChange={(e) => handleStatusChange(m, e.target.value)}
                        className="px-2 py-1 rounded border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/30"
                      >
                        <option value="active">Active</option>
                        <option value="trial">Trial</option>
                        <option value="suspended">Suspended</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.location.href = `/members/${m.id}`}
                      className="text-brand hover:text-brand-dark"
                    >
                      View
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setCreditModal({ userId: m.id, name: m.full_name }); setCreditAmount(""); }}
                      className="text-brand hover:text-brand-dark"
                    >
                      Add Credit
                    </Button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* Credit Modal */}
      <Modal
        open={!!creditModal}
        onClose={() => { setCreditModal(null); setCreditAmount(""); }}
        title={`Add Credit for ${creditModal?.name ?? ""}`}
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => { setCreditModal(null); setCreditAmount(""); }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddCredit}
              disabled={!creditAmount}
              loading={savingCredit}
            >
              {savingCredit ? "Adding..." : "Add Credit"}
            </Button>
          </>
        }
      >
        <FormInput
          label="Amount ($)"
          type="number"
          min={0}
          step={0.01}
          value={creditAmount}
          onChange={(val) => setCreditAmount(val)}
          placeholder="25.00"
        />
      </Modal>
    </div>
  );
}
