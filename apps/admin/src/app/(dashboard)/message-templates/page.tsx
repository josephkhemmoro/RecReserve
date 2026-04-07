"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAdminClub } from "@/lib/useAdminClub";
import { PageHeader, Card, Button, Badge, FormInput, FormSelect, FormTextarea, EmptyState, Skeleton } from "@/components/ui";

interface Template {
  id: string; name: string; subject: string; body: string;
  category: string; variables: string[]; is_active: boolean; created_at: string;
}

const CATEGORY_OPTIONS = [
  { value: "booking_confirmation", label: "Booking Confirmation" },
  { value: "booking_reminder", label: "Booking Reminder" },
  { value: "cancellation", label: "Cancellation Notice" },
  { value: "event_reminder", label: "Event Reminder" },
  { value: "weather_closure", label: "Weather Closure" },
  { value: "membership_welcome", label: "Welcome Message" },
  { value: "membership_expiring", label: "Membership Expiring" },
  { value: "no_show_warning", label: "No-Show Warning" },
  { value: "payment_receipt", label: "Payment Receipt" },
  { value: "general", label: "General" },
  { value: "custom", label: "Custom" },
];

const MERGE_FIELDS = ["member_name", "club_name", "court_name", "date", "time", "amount", "event_name", "program_name", "reason"];

const CATEGORY_VARIANT: Record<string, "brand" | "success" | "warning" | "error" | "default" | "info"> = {
  booking_confirmation: "success", booking_reminder: "info", cancellation: "error",
  event_reminder: "info", weather_closure: "warning", membership_welcome: "brand",
  membership_expiring: "warning", no_show_warning: "error", general: "default", custom: "default",
};

const EMPTY_FORM = { name: "", subject: "", body: "", category: "general" };

export default function MessageTemplatesPage() {
  const { admin, loading: adminLoading } = useAdminClub();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const fetchData = useCallback(async () => {
    if (!admin?.clubId) return;
    try {
      const supabase = createClient();
      const { data } = await supabase.from("message_templates").select("*")
        .eq("club_id", admin.clubId).order("category").order("name");
      setTemplates((data ?? []).map((t) => ({
        id: t.id as string, name: t.name as string, subject: t.subject as string,
        body: t.body as string, category: t.category as string,
        variables: (t.variables as string[]) ?? [], is_active: t.is_active as boolean,
        created_at: t.created_at as string,
      })));
    } catch (err) { console.error("Error:", err); }
    finally { setLoading(false); }
  }, [admin?.clubId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSeedDefaults = async () => {
    if (!admin?.clubId || !admin?.userId) return;
    setSeeding(true);
    try {
      const supabase = createClient();
      await supabase.rpc("seed_default_templates", { p_club_id: admin.clubId, p_created_by: admin.userId });
      fetchData();
    } catch (err) { console.error("Error seeding:", err); }
    finally { setSeeding(false); }
  };

  const handleSave = async () => {
    if (!admin?.clubId || !form.name.trim() || !form.body.trim()) return;
    setSaving(true);
    try {
      const supabase = createClient();
      // Extract variables from body
      const vars = Array.from(form.body.matchAll(/\{\{(\w+)\}\}/g)).map((m) => m[1]);
      const payload = {
        club_id: admin.clubId, name: form.name.trim(), subject: form.subject.trim(),
        body: form.body.trim(), category: form.category, variables: vars,
        created_by: admin.userId,
      };
      if (editingId) { await supabase.from("message_templates").update(payload).eq("id", editingId); }
      else { await supabase.from("message_templates").insert(payload); }
      setShowForm(false); setForm(EMPTY_FORM); setEditingId(null); fetchData();
    } catch (err) { console.error("Error:", err); }
    finally { setSaving(false); }
  };

  const handleEdit = (t: Template) => {
    setForm({ name: t.name, subject: t.subject, body: t.body, category: t.category });
    setEditingId(t.id); setShowForm(true);
  };

  const handleToggle = async (id: string, active: boolean) => {
    try { const supabase = createClient(); await supabase.from("message_templates").update({ is_active: !active }).eq("id", id); fetchData(); }
    catch (err) { console.error("Error:", err); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    try { const supabase = createClient(); await supabase.from("message_templates").delete().eq("id", id); fetchData(); }
    catch (err) { console.error("Error:", err); }
  };

  const isLoading = adminLoading || loading;

  return (
    <div>
      <PageHeader title="Message Templates" action={
        <div className="flex gap-2">
          {templates.length === 0 && (
            <Button variant="secondary" onClick={handleSeedDefaults} disabled={seeding}>
              {seeding ? "Loading..." : "Load Defaults"}
            </Button>
          )}
          <Button onClick={() => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(true); }}>New Template</Button>
        </div>
      } />

      <Card className="mb-4">
        <p className="text-sm text-slate-500">
          Templates use merge fields like <code className="bg-slate-100 px-1 rounded text-xs">{"{{member_name}}"}</code> that get replaced with real values when sent. Available fields: {MERGE_FIELDS.map((f) => <code key={f} className="bg-slate-100 px-1 rounded text-xs mx-0.5">{`{{${f}}}`}</code>)}
        </p>
      </Card>

      {showForm && (
        <Card title={editingId ? "Edit Template" : "New Template"} className="mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput label="Template Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Booking Confirmation" />
            <FormSelect label="Category" value={form.category} onChange={(v) => setForm({ ...form, category: v })} options={CATEGORY_OPTIONS} />
            <FormInput label="Subject" value={form.subject} onChange={(v) => setForm({ ...form, subject: v })} placeholder="Your booking is confirmed" className="sm:col-span-2" />
            <FormTextarea label="Body" value={form.body} onChange={(v) => setForm({ ...form, body: v })} rows={4} placeholder="Hi {{member_name}}, your booking at {{court_name}}..." className="sm:col-span-2" />
          </div>
          <div className="flex gap-3 mt-4">
            <Button onClick={handleSave} disabled={saving || !form.name.trim() || !form.body.trim()} loading={saving}>{saving ? "Saving..." : editingId ? "Update" : "Create"}</Button>
            <Button variant="secondary" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancel</Button>
          </div>
        </Card>
      )}

      <Card noPadding>
        {isLoading ? (<div className="p-6 space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>)
        : templates.length === 0 ? (<EmptyState title="No templates yet" description="Click 'Load Defaults' to start with standard templates, or create your own." />)
        : (
          <table className="w-full">
            <thead><tr className="border-b border-slate-100">
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Subject</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Fields</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
            </tr></thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-6 py-3 text-sm font-medium text-slate-900">{t.name}</td>
                  <td className="px-6 py-3"><Badge label={t.category.replace(/_/g, " ")} variant={CATEGORY_VARIANT[t.category] ?? "default"} /></td>
                  <td className="px-6 py-3 text-sm text-slate-600 max-w-xs truncate">{t.subject}</td>
                  <td className="px-6 py-3 text-xs text-slate-500">{t.variables.length > 0 ? t.variables.map((v) => `{{${v}}}`).join(", ") : "—"}</td>
                  <td className="px-6 py-3"><Badge label={t.is_active ? "Active" : "Inactive"} variant={t.is_active ? "success" : "default"} /></td>
                  <td className="px-6 py-3 text-right space-x-2">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(t)}>Edit</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleToggle(t.id, t.is_active)}>{t.is_active ? "Disable" : "Enable"}</Button>
                    <Button variant="danger" size="sm" onClick={() => handleDelete(t.id)}>Delete</Button>
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
