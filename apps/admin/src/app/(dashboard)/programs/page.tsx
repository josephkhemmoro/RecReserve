"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAdminClub } from "@/lib/useAdminClub";
import { PageHeader, Card, Button, Badge, FormInput, FormSelect, FormTextarea, EmptyState, Skeleton } from "@/components/ui";

interface Instructor { id: string; full_name: string; }
interface Court { id: string; name: string; }
interface Program {
  id: string; title: string; program_type: string; status: string;
  start_date: string; end_date: string | null; price: number; member_price: number | null;
  max_participants: number | null; instructor_name: string | null; court_name: string | null;
  registration_count: number;
}

const PROGRAM_TYPES = [
  { value: "lesson_series", label: "Lesson Series" },
  { value: "clinic_series", label: "Clinic Series" },
  { value: "camp", label: "Camp" },
  { value: "academy", label: "Academy" },
  { value: "drop_in_series", label: "Drop-In Series" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "registration_open", label: "Registration Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const SKILL_OPTIONS = [
  { value: "", label: "All Levels" },
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const STATUS_VARIANT: Record<string, "brand" | "success" | "warning" | "error" | "default" | "info"> = {
  draft: "default", published: "info", registration_open: "brand", in_progress: "success", completed: "default", cancelled: "error",
};

const EMPTY_FORM = {
  title: "", description: "", program_type: "lesson_series", start_date: "", end_date: "",
  start_time: "09:00", end_time: "10:00", max_participants: "", min_participants: "",
  price: "0", member_price: "", drop_in_price: "", instructor_id: "", court_id: "",
  skill_level: "", status: "draft",
};

export default function ProgramsPage() {
  const { admin, loading: adminLoading } = useAdminClub();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!admin?.clubId) return;
    try {
      const supabase = createClient();
      const [programsRes, instructorsRes, courtsRes] = await Promise.all([
        supabase.from("programs")
          .select("*, instructor:users!programs_instructor_id_fkey(full_name), court:courts(name)")
          .eq("club_id", admin.clubId).order("start_date", { ascending: false }),
        supabase.from("users").select("id, full_name").eq("club_id", admin.clubId).eq("role", "coach"),
        supabase.from("courts").select("id, name").eq("club_id", admin.clubId).eq("is_active", true),
      ]);

      // Get registration counts
      const programIds = (programsRes.data ?? []).map((p: Record<string, unknown>) => p.id as string);
      let regCounts = new Map<string, number>();
      if (programIds.length > 0) {
        const { data: regs } = await supabase.from("program_registrations").select("program_id").in("program_id", programIds).eq("status", "registered");
        for (const r of regs ?? []) { const pid = r.program_id as string; regCounts.set(pid, (regCounts.get(pid) ?? 0) + 1); }
      }

      setPrograms((programsRes.data ?? []).map((p: Record<string, unknown>) => ({
        id: p.id as string, title: p.title as string, program_type: p.program_type as string,
        status: p.status as string, start_date: p.start_date as string, end_date: p.end_date as string | null,
        price: Number(p.price) || 0, member_price: p.member_price != null ? Number(p.member_price) : null,
        max_participants: p.max_participants as number | null,
        instructor_name: (p.instructor as { full_name: string } | null)?.full_name ?? null,
        court_name: (p.court as { name: string } | null)?.name ?? null,
        registration_count: regCounts.get(p.id as string) ?? 0,
      })));
      setInstructors((instructorsRes.data ?? []).map((i: Record<string, unknown>) => ({ id: i.id as string, full_name: i.full_name as string })));
      setCourts((courtsRes.data ?? []).map((c: Record<string, unknown>) => ({ id: c.id as string, name: c.name as string })));
    } catch (err) { console.error("Error fetching programs:", err); }
    finally { setLoading(false); }
  }, [admin?.clubId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    if (!admin?.clubId || !form.title.trim() || !form.start_date) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const payload = {
        club_id: admin.clubId, title: form.title.trim(), description: form.description || null,
        program_type: form.program_type, start_date: form.start_date, end_date: form.end_date || null,
        start_time: form.start_time || null, end_time: form.end_time || null,
        max_participants: form.max_participants ? Number(form.max_participants) : null,
        min_participants: form.min_participants ? Number(form.min_participants) : null,
        price: Number(form.price) || 0, member_price: form.member_price ? Number(form.member_price) : null,
        drop_in_price: form.drop_in_price ? Number(form.drop_in_price) : null,
        instructor_id: form.instructor_id || null, court_id: form.court_id || null,
        skill_level: form.skill_level || null, status: form.status,
      };
      if (editingId) { await supabase.from("programs").update(payload).eq("id", editingId); }
      else { await supabase.from("programs").insert(payload); }
      setShowForm(false); setForm(EMPTY_FORM); setEditingId(null); fetchData();
    } catch (err) { console.error("Error saving program:", err); }
    finally { setSaving(false); }
  };

  const handleEdit = (p: Program) => {
    // Fetch full program data for editing
    const loadFull = async () => {
      const supabase = createClient();
      const { data } = await supabase.from("programs").select("*").eq("id", p.id).single();
      if (!data) return;
      setForm({
        title: data.title as string, description: (data.description as string) || "",
        program_type: data.program_type as string, start_date: data.start_date as string,
        end_date: (data.end_date as string) || "", start_time: (data.start_time as string) || "09:00",
        end_time: (data.end_time as string) || "10:00",
        max_participants: data.max_participants != null ? String(data.max_participants) : "",
        min_participants: data.min_participants != null ? String(data.min_participants) : "",
        price: String(data.price || 0), member_price: data.member_price != null ? String(data.member_price) : "",
        drop_in_price: data.drop_in_price != null ? String(data.drop_in_price) : "",
        instructor_id: (data.instructor_id as string) || "", court_id: (data.court_id as string) || "",
        skill_level: (data.skill_level as string) || "", status: data.status as string,
      });
      setEditingId(p.id); setShowForm(true);
    };
    loadFull();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this program? Registrations will also be removed.")) return;
    try { const supabase = createClient(); await supabase.from("programs").delete().eq("id", id); fetchData(); }
    catch (err) { console.error("Error deleting program:", err); }
  };

  const isLoading = adminLoading || loading;
  const formatType = (t: string) => PROGRAM_TYPES.find((pt) => pt.value === t)?.label ?? t;

  return (
    <div>
      <PageHeader title="Programs" action={<Button onClick={() => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(true); }}>Create Program</Button>} />

      {showForm && (
        <Card title={editingId ? "Edit Program" : "New Program"} className="mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FormInput label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="Beginner Pickleball Clinic" className="sm:col-span-2 lg:col-span-3" />
            <FormSelect label="Type" value={form.program_type} onChange={(v) => setForm({ ...form, program_type: v })} options={PROGRAM_TYPES} />
            <FormSelect label="Status" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={STATUS_OPTIONS} />
            <FormSelect label="Skill Level" value={form.skill_level} onChange={(v) => setForm({ ...form, skill_level: v })} options={SKILL_OPTIONS} />
            <FormInput label="Start Date" type="date" value={form.start_date} onChange={(v) => setForm({ ...form, start_date: v })} />
            <FormInput label="End Date" type="date" value={form.end_date} onChange={(v) => setForm({ ...form, end_date: v })} />
            <div className="flex gap-2">
              <FormInput label="Start Time" type="time" value={form.start_time} onChange={(v) => setForm({ ...form, start_time: v })} className="flex-1" />
              <FormInput label="End Time" type="time" value={form.end_time} onChange={(v) => setForm({ ...form, end_time: v })} className="flex-1" />
            </div>
            <FormInput label="Max Participants" type="number" value={form.max_participants} onChange={(v) => setForm({ ...form, max_participants: v })} placeholder="Unlimited" />
            <FormInput label="Min Participants" type="number" value={form.min_participants} onChange={(v) => setForm({ ...form, min_participants: v })} />
            <FormInput label="Price ($)" type="number" min={0} step={0.01} value={form.price} onChange={(v) => setForm({ ...form, price: v })} />
            <FormInput label="Member Price ($)" type="number" min={0} step={0.01} value={form.member_price} onChange={(v) => setForm({ ...form, member_price: v })} placeholder="Same as price" />
            <FormInput label="Drop-In Price ($)" type="number" min={0} step={0.01} value={form.drop_in_price} onChange={(v) => setForm({ ...form, drop_in_price: v })} placeholder="N/A" />
            <FormSelect label="Instructor" value={form.instructor_id} onChange={(v) => setForm({ ...form, instructor_id: v })} options={[{ value: "", label: "No Instructor" }, ...instructors.map((i) => ({ value: i.id, label: i.full_name }))]} />
            <FormSelect label="Court" value={form.court_id} onChange={(v) => setForm({ ...form, court_id: v })} options={[{ value: "", label: "No Court" }, ...courts.map((c) => ({ value: c.id, label: c.name }))]} />
            <FormTextarea label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} rows={2} className="sm:col-span-2 lg:col-span-3" />
          </div>
          <div className="flex gap-3 mt-4">
            <Button onClick={handleSave} disabled={saving || !form.title.trim() || !form.start_date} loading={saving}>{saving ? "Saving..." : editingId ? "Update" : "Create"}</Button>
            <Button variant="secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</Button>
          </div>
        </Card>
      )}

      <Card noPadding>
        {isLoading ? (<div className="p-6 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>)
        : programs.length === 0 ? (<EmptyState title="No programs yet" description="Create your first program to start offering lessons, clinics, and camps." />)
        : (
          <table className="w-full">
            <thead><tr className="border-b border-slate-100">
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Title</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Dates</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Instructor</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Registered</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
            </tr></thead>
            <tbody>
              {programs.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-6 py-3 text-sm font-medium text-slate-900">{p.title}</td>
                  <td className="px-6 py-3 text-sm text-slate-600">{formatType(p.program_type)}</td>
                  <td className="px-6 py-3 text-sm text-slate-600">{new Date(p.start_date + "T00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}{p.end_date ? ` - ${new Date(p.end_date + "T00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}</td>
                  <td className="px-6 py-3 text-sm text-slate-600">{p.instructor_name || "\u2014"}</td>
                  <td className="px-6 py-3 text-sm text-slate-600">{p.registration_count}{p.max_participants ? ` / ${p.max_participants}` : ""}</td>
                  <td className="px-6 py-3 text-sm text-slate-600">{Number(p.price) > 0 ? `$${p.price}` : "Free"}{p.member_price != null ? ` / $${p.member_price}` : ""}</td>
                  <td className="px-6 py-3"><Badge label={p.status.replace("_", " ")} variant={STATUS_VARIANT[p.status] ?? "default"} /></td>
                  <td className="px-6 py-3 text-right space-x-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(p)}>Edit</Button>
                    <Button variant="danger" size="sm" onClick={() => handleDelete(p.id)}>Delete</Button>
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
