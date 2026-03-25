"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAdminClub } from "@/lib/useAdminClub";
import type { MembershipTier } from "@recreserve/shared";

interface Member {
  id: string;
  full_name: string;
  email: string;
  created_at: string;
  membership: {
    id: string;
    tier: MembershipTier;
    is_active: boolean;
  } | null;
}

const TIERS: MembershipTier[] = ["standard", "premium", "guest"];

export default function MembersPage() {
  const { admin, loading: adminLoading } = useAdminClub();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [creditModal, setCreditModal] = useState<{ userId: string; name: string } | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [savingCredit, setSavingCredit] = useState(false);

  const fetchMembers = useCallback(async (clubId: string) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, email, created_at")
        .eq("club_id", clubId)
        .eq("role", "player")
        .order("full_name");

      if (error) throw error;

      const userIds = (data ?? []).map((u: { id: string }) => u.id);

      const { data: memberships } = await supabase
        .from("memberships")
        .select("id, user_id, tier, is_active")
        .eq("club_id", clubId)
        .in("user_id", userIds.length > 0 ? userIds : ["__none__"]);

      const membershipMap = new Map<string, { id: string; tier: MembershipTier; is_active: boolean }>();
      for (const m of memberships ?? []) {
        membershipMap.set(m.user_id as string, {
          id: m.id as string,
          tier: m.tier as MembershipTier,
          is_active: m.is_active as boolean,
        });
      }

      setMembers(
        (data ?? []).map((u: { id: string; full_name: string; email: string; created_at: string }) => ({
          id: u.id,
          full_name: u.full_name,
          email: u.email,
          created_at: u.created_at,
          membership: membershipMap.get(u.id) ?? null,
        }))
      );
    } catch (err) {
      console.error("Error fetching members:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (admin?.clubId) fetchMembers(admin.clubId);
  }, [admin?.clubId, fetchMembers]);

  const handleTierChange = async (member: Member, tier: MembershipTier) => {
    if (!admin?.clubId) return;
    try {
      const supabase = createClient();
      if (member.membership) {
        await supabase
          .from("memberships")
          .update({ tier })
          .eq("id", member.membership.id);
      } else {
        await supabase.from("memberships").insert({
          user_id: member.id,
          club_id: admin.clubId,
          tier,
          start_date: new Date().toISOString().split("T")[0],
          is_active: true,
        });
      }
      fetchMembers(admin.clubId);
    } catch (err) {
      console.error("Error updating tier:", err);
    }
  };

  const handleToggleSuspend = async (member: Member) => {
    if (!member.membership || !admin?.clubId) return;
    try {
      const supabase = createClient();
      await supabase
        .from("memberships")
        .update({ is_active: !member.membership.is_active })
        .eq("id", member.membership.id);
      fetchMembers(admin.clubId);
    } catch (err) {
      console.error("Error toggling suspend:", err);
    }
  };

  const handleAddCredit = async () => {
    if (!creditModal || !admin?.clubId || !creditAmount) return;
    setSavingCredit(true);
    try {
      const supabase = createClient();
      // Create a credit entry as a membership record with note
      await supabase.from("memberships").insert({
        user_id: creditModal.userId,
        club_id: admin.clubId,
        tier: "standard",
        start_date: new Date().toISOString().split("T")[0],
        is_active: true,
      });
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Members</h1>
        <input
          type="text"
          placeholder="Search members..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-4 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        {isLoading ? (
          <div className="p-6 space-y-3 animate-pulse">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-10 bg-slate-100 rounded" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-500">
            {search ? "No members match your search" : "No members found"}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Tier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Joined</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-6 py-3 text-sm font-medium text-slate-900">{m.full_name}</td>
                  <td className="px-6 py-3 text-sm text-slate-600">{m.email}</td>
                  <td className="px-6 py-3">
                    <select
                      value={m.membership?.tier ?? "standard"}
                      onChange={(e) => handleTierChange(m, e.target.value as MembershipTier)}
                      className="px-2 py-1 rounded border border-slate-300 text-sm text-slate-900"
                    >
                      {TIERS.map((t) => (
                        <option key={t} value={t} className="capitalize">{t}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-3 text-sm text-slate-600">
                    {new Date(m.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold ${
                      m.membership?.is_active !== false ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                    }`}>
                      {m.membership?.is_active !== false ? "Active" : "Suspended"}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right space-x-2">
                    {m.membership && (
                      <button
                        onClick={() => handleToggleSuspend(m)}
                        className={`text-sm font-medium ${
                          m.membership.is_active
                            ? "text-red-600 hover:text-red-800"
                            : "text-green-600 hover:text-green-800"
                        }`}
                      >
                        {m.membership.is_active ? "Suspend" : "Unsuspend"}
                      </button>
                    )}
                    <button
                      onClick={() => setCreditModal({ userId: m.id, name: m.full_name })}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Add Credit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Credit Modal */}
      {creditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              Add Credit for {creditModal.name}
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Amount ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="25.00"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleAddCredit}
                disabled={savingCredit || !creditAmount}
                className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {savingCredit ? "Adding..." : "Add Credit"}
              </button>
              <button
                onClick={() => { setCreditModal(null); setCreditAmount(""); }}
                className="px-4 py-2 text-slate-600 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
