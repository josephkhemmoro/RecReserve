"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAdminClub } from "@/lib/useAdminClub";
import { PageHeader, Card, Button, Badge, FormInput, FormSelect, FormTextarea, EmptyState, Skeleton } from "@/components/ui";

interface League {
  id: string; name: string; format: string; status: string; start_date: string;
  end_date: string | null; entry_fee: number; max_players: number | null;
  player_count: number; match_count: number; skill_level: string | null;
}

const FORMAT_OPTIONS = [
  { value: "ladder", label: "Ladder" }, { value: "round_robin", label: "Round Robin" },
  { value: "league", label: "League" }, { value: "knockout", label: "Knockout" },
];
const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" }, { value: "registration_open", label: "Registration Open" },
  { value: "in_progress", label: "In Progress" }, { value: "completed", label: "Completed" },
];
const SKILL_OPTIONS = [
  { value: "", label: "Open" }, { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" }, { value: "advanced", label: "Advanced" },
];
const STATUS_VARIANT: Record<string, "brand" | "success" | "warning" | "error" | "default" | "info"> = {
  draft: "default", registration_open: "brand", in_progress: "success", completed: "default", cancelled: "error",
};

const EMPTY_FORM = {
  name: "", description: "", format: "ladder", skill_level: "", start_date: "", end_date: "",
  match_duration_mins: "60", max_players: "", entry_fee: "0", member_entry_fee: "",
  points_for_win: "3", points_for_draw: "1", points_for_loss: "0", status: "draft",
};

export default function LeaguesPage() {
  const { admin, loading: adminLoading } = useAdminClub();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!admin?.clubId) return;
    try {
      const supabase = createClient();
      const { data } = await supabase.from("leagues").select("*").eq("club_id", admin.clubId).order("start_date", { ascending: false });
      const leagueIds = (data ?? []).map((l: Record<string, unknown>) => l.id as string);
      let playerCounts = new Map<string, number>();
      let matchCounts = new Map<string, number>();
      if (leagueIds.length > 0) {
        const [playersRes, matchesRes] = await Promise.all([
          supabase.from("league_players").select("league_id").in("league_id", leagueIds).eq("status", "active"),
          supabase.from("league_matches").select("league_id").in("league_id", leagueIds),
        ]);
        for (const p of playersRes.data ?? []) { const lid = p.league_id as string; playerCounts.set(lid, (playerCounts.get(lid) ?? 0) + 1); }
        for (const m of matchesRes.data ?? []) { const lid = m.league_id as string; matchCounts.set(lid, (matchCounts.get(lid) ?? 0) + 1); }
      }
      setLeagues((data ?? []).map((l: Record<string, unknown>) => ({
        id: l.id as string, name: l.name as string, format: l.format as string, status: l.status as string,
        start_date: l.start_date as string, end_date: l.end_date as string | null,
        entry_fee: Number(l.entry_fee) || 0, max_players: l.max_players as number | null,
        skill_level: l.skill_level as string | null,
        player_count: playerCounts.get(l.id as string) ?? 0,
        match_count: matchCounts.get(l.id as string) ?? 0,
      })));
    } catch (err) { console.error("Error fetching leagues:", err); }
    finally { setLoading(false); }
  }, [admin?.clubId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    if (!admin?.clubId || !form.name.trim() || !form.start_date) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const payload = {
        club_id: admin.clubId, name: form.name.trim(), description: form.description || null,
        format: form.format, skill_level: form.skill_level || null,
        start_date: form.start_date, end_date: form.end_date || null,
        match_duration_mins: Number(form.match_duration_mins) || 60,
        max_players: form.max_players ? Number(form.max_players) : null,
        entry_fee: Number(form.entry_fee) || 0, member_entry_fee: form.member_entry_fee ? Number(form.member_entry_fee) : null,
        points_for_win: Number(form.points_for_win) || 3, points_for_draw: Number(form.points_for_draw) || 1,
        points_for_loss: Number(form.points_for_loss) || 0, status: form.status,
      };
      if (editingId) { await supabase.from("leagues").update(payload).eq("id", editingId); }
      else { await supabase.from("leagues").insert(payload); }
      setShowForm(false); setForm(EMPTY_FORM); setEditingId(null); fetchData();
    } catch (err) { console.error("Error saving league:", err); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this league? All matches and standings will be removed.")) return;
    try { const supabase = createClient(); await supabase.from("leagues").delete().eq("id", id); fetchData(); }
    catch (err) { console.error("Error deleting:", err); }
  };

  const isLoading = adminLoading || loading;

  return (
    <div>
      <PageHeader title="Leagues & Organized Play" action={<Button onClick={() => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(true); }}>Create League</Button>} />
      {showForm && (
        <Card title={editingId ? "Edit League" : "New League"} className="mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormInput label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Spring Ladder" className="sm:col-span-2" />
            <FormSelect label="Format" value={form.format} onChange={(v) => setForm({ ...form, format: v })} options={FORMAT_OPTIONS} />
            <FormSelect label="Skill Level" value={form.skill_level} onChange={(v) => setForm({ ...form, skill_level: v })} options={SKILL_OPTIONS} />
            <FormSelect label="Status" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={STATUS_OPTIONS} />
            <FormInput label="Start Date" type="date" value={form.start_date} onChange={(v) => setForm({ ...form, start_date: v })} />
            <FormInput label="End Date" type="date" value={form.end_date} onChange={(v) => setForm({ ...form, end_date: v })} />
            <FormInput label="Match Duration (mins)" type="number" value={form.match_duration_mins} onChange={(v) => setForm({ ...form, match_duration_mins: v })} />
            <FormInput label="Max Players" type="number" value={form.max_players} onChange={(v) => setForm({ ...form, max_players: v })} placeholder="Unlimited" />
            <FormInput label="Entry Fee ($)" type="number" min={0} value={form.entry_fee} onChange={(v) => setForm({ ...form, entry_fee: v })} />
            <FormInput label="Member Fee ($)" type="number" min={0} value={form.member_entry_fee} onChange={(v) => setForm({ ...form, member_entry_fee: v })} placeholder="Same" />
            <FormTextarea label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} rows={2} className="sm:col-span-2 lg:col-span-3" />
          </div>
          <div className="flex gap-3 mt-4">
            <Button onClick={handleSave} disabled={saving || !form.name.trim() || !form.start_date} loading={saving}>{saving ? "Saving..." : editingId ? "Update" : "Create"}</Button>
            <Button variant="secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</Button>
          </div>
        </Card>
      )}
      <Card noPadding>
        {isLoading ? (<div className="p-6 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>)
        : leagues.length === 0 ? (<EmptyState title="No leagues yet" description="Create a ladder, round robin, or league to get organized play started." />)
        : (
          <table className="w-full">
            <thead><tr className="border-b border-slate-100">
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Format</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Dates</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Players</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Matches</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Fee</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
            </tr></thead>
            <tbody>
              {leagues.map((l) => (
                <tr key={l.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-6 py-3"><p className="text-sm font-medium text-slate-900">{l.name}</p>{l.skill_level && <p className="text-xs text-slate-400">{l.skill_level}</p>}</td>
                  <td className="px-6 py-3 text-sm text-slate-600 capitalize">{l.format.replace("_", " ")}</td>
                  <td className="px-6 py-3 text-sm text-slate-600">{new Date(l.start_date + "T00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}{l.end_date ? ` - ${new Date(l.end_date + "T00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}</td>
                  <td className="px-6 py-3 text-sm text-slate-600">{l.player_count}{l.max_players ? ` / ${l.max_players}` : ""}</td>
                  <td className="px-6 py-3 text-sm text-slate-600">{l.match_count}</td>
                  <td className="px-6 py-3 text-sm text-slate-600">{l.entry_fee > 0 ? `$${l.entry_fee}` : "Free"}</td>
                  <td className="px-6 py-3"><Badge label={l.status.replace("_", " ")} variant={STATUS_VARIANT[l.status] ?? "default"} /></td>
                  <td className="px-6 py-3 text-right space-x-2">
                    <Button variant="ghost" size="sm" onClick={() => { /* TODO: edit */ }}>Edit</Button>
                    <Button variant="danger" size="sm" onClick={() => handleDelete(l.id)}>Delete</Button>
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
