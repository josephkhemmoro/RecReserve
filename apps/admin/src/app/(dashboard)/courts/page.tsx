"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAdminClub } from "@/lib/useAdminClub";
import { PageHeader, Card, FormInput, Button, Badge, EmptyState, Skeleton } from "@/components/ui";
import type { DayOfWeek } from "@recreserve/shared";

interface Court {
  id: string;
  name: string;
  is_active: boolean;
  hourly_rate: number;
  is_free: boolean;
}

interface CourtForm {
  name: string;
  hourly_rate: number;
  is_free: boolean;
}

interface AvailabilityRow {
  id: string;
  court_id: string;
  day_of_week: DayOfWeek;
  open_time: string;
  close_time: string;
}

const DAY_LABELS: { short: string; full: string }[] = [
  { short: "Sun", full: "Sunday" },
  { short: "Mon", full: "Monday" },
  { short: "Tue", full: "Tuesday" },
  { short: "Wed", full: "Wednesday" },
  { short: "Thu", full: "Thursday" },
  { short: "Fri", full: "Friday" },
  { short: "Sat", full: "Saturday" },
];

const EMPTY_FORM: CourtForm = { name: "", hourly_rate: 0, is_free: false };

export default function CourtsPage() {
  const { admin, loading: adminLoading } = useAdminClub();
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<CourtForm>(EMPTY_FORM);
  const [addFormError, setAddFormError] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [editingCourtId, setEditingCourtId] = useState<string | null>(null);

  const fetchCourts = useCallback(async (clubId: string) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("courts")
        .select("id, name, is_active, hourly_rate, is_free")
        .eq("club_id", clubId)
        .order("name");
      if (error) throw error;
      setCourts((data ?? []) as Court[]);
    } catch (err) {
      console.error("Error fetching courts:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (admin?.clubId) fetchCourts(admin.clubId);
  }, [admin?.clubId, fetchCourts]);

  const handleAddCourt = async () => {
    if (!admin?.clubId || !addForm.name.trim()) return;
    if (!addForm.is_free && addForm.hourly_rate < 0) {
      setAddFormError("Hourly rate cannot be negative");
      return;
    }
    setAddSaving(true);
    setAddFormError("");
    try {
      const supabase = createClient();
      const { error } = await supabase.from("courts").insert({
        club_id: admin.clubId,
        name: addForm.name.trim(),
        hourly_rate: addForm.is_free ? 0 : addForm.hourly_rate,
        is_free: addForm.is_free,
        is_active: true,
      });
      if (error) throw error;
      setShowAddForm(false);
      setAddForm(EMPTY_FORM);
      setAddFormError("");
      fetchCourts(admin.clubId);
    } catch (err) {
      console.error("Error adding court:", err);
      setAddFormError(err instanceof Error ? err.message : "Failed to add court");
    } finally {
      setAddSaving(false);
    }
  };

  const handleToggleEdit = (courtId: string) => {
    setEditingCourtId(editingCourtId === courtId ? null : courtId);
  };

  const isLoading = adminLoading || loading;

  return (
    <div>
      <PageHeader
        title="Courts"
        action={
          <Button
            onClick={() => {
              setShowAddForm(true);
              setAddForm(EMPTY_FORM);
              setAddFormError("");
            }}
          >
            Add Court
          </Button>
        }
      />

      {/* Add Court Form */}
      {showAddForm && (
        <Card title="New Court" className="mb-6">
          {addFormError && (
            <div className="bg-error-light border border-red-200 text-error px-4 py-3 rounded-lg mb-4 text-sm">
              {addFormError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              label="Name"
              value={addForm.name}
              onChange={(v) => setAddForm({ ...addForm, name: v })}
              placeholder="Court 1"
            />
            <FormInput
              label="Hourly Rate ($)"
              type="number"
              min={0}
              step={0.01}
              value={addForm.is_free ? "" : addForm.hourly_rate}
              onChange={(v) => setAddForm({ ...addForm, hourly_rate: Math.max(0, Number(v)) })}
              disabled={addForm.is_free}
              placeholder="0.00"
            />
            <div className="flex items-end">
              <label className="flex items-center gap-3 cursor-pointer py-2">
                <button
                  type="button"
                  onClick={() => setAddForm({ ...addForm, is_free: !addForm.is_free })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${addForm.is_free ? "bg-brand" : "bg-slate-300"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${addForm.is_free ? "translate-x-5" : "translate-x-0"}`} />
                </button>
                <span className="text-sm font-medium text-slate-700">Free court (no payment required)</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <Button
              onClick={handleAddCourt}
              disabled={addSaving || !addForm.name.trim()}
              loading={addSaving}
            >
              {addSaving ? "Creating..." : "Create"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => { setShowAddForm(false); setAddFormError(""); }}
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Courts List */}
      {isLoading ? (
        <Card>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}
          </div>
        </Card>
      ) : courts.length === 0 ? (
        <Card>
          <EmptyState
            title="No courts yet"
            description="Add your first court to get started."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {courts.map((court) => (
            <CourtCard
              key={court.id}
              court={court}
              isEditing={editingCourtId === court.id}
              onToggleEdit={() => handleToggleEdit(court.id)}
              onRefreshCourts={() => admin?.clubId && fetchCourts(admin.clubId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Court Card with inline edit ─── */

function CourtCard({
  court,
  isEditing,
  onToggleEdit,
  onRefreshCourts,
}: {
  court: Court;
  isEditing: boolean;
  onToggleEdit: () => void;
  onRefreshCourts: () => void;
}) {
  const [form, setForm] = useState<CourtForm>({
    name: court.name,
    hourly_rate: court.hourly_rate,
    is_free: court.is_free,
  });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityRow[]>([]);
  const [loadingAvail, setLoadingAvail] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Reset form when court prop changes or panel opens
  useEffect(() => {
    if (isEditing) {
      setForm({
        name: court.name,
        hourly_rate: court.hourly_rate,
        is_free: court.is_free,
      });
      setFormError("");
      setShowDeleteConfirm(false);
      fetchAvailability();
    }
  }, [isEditing, court.id]);

  const fetchAvailability = async () => {
    setLoadingAvail(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("court_availability")
        .select("*")
        .eq("court_id", court.id)
        .order("day_of_week");
      if (error) throw error;
      setAvailability((data ?? []) as AvailabilityRow[]);
    } catch (err) {
      console.error("Error fetching availability:", err);
    } finally {
      setLoadingAvail(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    if (!form.is_free && form.hourly_rate < 0) {
      setFormError("Hourly rate cannot be negative");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("courts")
        .update({
          name: form.name.trim(),
          hourly_rate: form.is_free ? 0 : form.hourly_rate,
          is_free: form.is_free,
        })
        .eq("id", court.id);
      if (error) throw error;
      onRefreshCourts();
    } catch (err) {
      console.error("Error saving court:", err);
      setFormError(err instanceof Error ? err.message : "Failed to save court");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("courts")
        .update({ is_active: !court.is_active })
        .eq("id", court.id);
      if (error) throw error;
      onRefreshCourts();
    } catch (err) {
      console.error("Error toggling court:", err);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const supabase = createClient();
      // Delete availability first, then the court
      await supabase.from("court_availability").delete().eq("court_id", court.id);
      const { error } = await supabase.from("courts").delete().eq("id", court.id);
      if (error) throw error;
      onRefreshCourts();
    } catch (err) {
      console.error("Error deleting court:", err);
      setFormError(err instanceof Error ? err.message : "Failed to delete court");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Summary Row */}
      <div
        className={`px-6 py-4 flex items-center cursor-pointer hover:bg-slate-50/50 transition-colors ${isEditing ? "border-b border-slate-200" : ""}`}
        onClick={onToggleEdit}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-900 truncate">{court.name}</span>
            <Badge
              label={court.is_active ? "Active" : "Inactive"}
              variant={court.is_active ? "success" : "default"}
            />
          </div>
          <div className="flex items-center gap-3 mt-1">
            {court.is_free ? (
              <span className="text-xs font-medium text-success">Free</span>
            ) : (
              <span className="text-xs text-slate-500">${court.hourly_rate.toFixed(2)}/hr</span>
            )}
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-slate-400 transition-transform ${isEditing ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expanded Edit Panel */}
      {isEditing && (
        <div>
          {/* Court Details Section */}
          <div className="px-6 py-5 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-4">Court Details</h3>

            {formError && (
              <div className="bg-error-light border border-red-200 text-error px-4 py-3 rounded-lg mb-4 text-sm">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormInput
                label="Name"
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
              />
              <FormInput
                label="Hourly Rate ($)"
                type="number"
                min={0}
                step={0.01}
                value={form.is_free ? "" : form.hourly_rate}
                onChange={(v) => setForm({ ...form, hourly_rate: Math.max(0, Number(v)) })}
                disabled={form.is_free}
                placeholder="0.00"
              />
              <div className="flex items-end">
                <label className="flex items-center gap-3 cursor-pointer py-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, is_free: !form.is_free })}
                    className={`relative w-11 h-6 rounded-full transition-colors ${form.is_free ? "bg-brand" : "bg-slate-300"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_free ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                  <span className="text-sm font-medium text-slate-700">Free court</span>
                </label>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4">
              <Button
                onClick={handleSave}
                disabled={saving || !form.name.trim()}
                loading={saving}
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                variant="secondary"
                onClick={handleToggleActive}
                className={
                  court.is_active
                    ? "!text-warning !border-warning/30 !bg-warning-light hover:!bg-warning-light/80"
                    : "!text-success !border-success/30 !bg-success-light hover:!bg-success-light/80"
                }
              >
                {court.is_active ? "Deactivate" : "Activate"}
              </Button>
            </div>
          </div>

          {/* Hours Section */}
          <div className="border-b border-slate-100">
            <AvailabilityPanel
              court={court}
              availability={availability}
              loading={loadingAvail}
              onRefresh={fetchAvailability}
            />
          </div>

          {/* Danger Zone */}
          <div className="px-6 py-5">
            <h3 className="text-sm font-semibold text-error uppercase tracking-wide mb-3">Danger Zone</h3>
            {!showDeleteConfirm ? (
              <Button
                variant="danger"
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete Court
              </Button>
            ) : (
              <div className="flex items-center gap-3 p-4 bg-error-light rounded-lg border border-red-200">
                <p className="text-sm text-error flex-1">
                  Permanently delete <strong>{court.name}</strong>? This will also remove all availability and reservations for this court. This cannot be undone.
                </p>
                <Button
                  variant="danger"
                  onClick={handleDelete}
                  loading={deleting}
                  className="!bg-red-600 !text-white hover:!bg-red-700 whitespace-nowrap"
                >
                  {deleting ? "Deleting..." : "Yes, Delete"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Availability Panel ─── */

function AvailabilityPanel({
  court,
  availability,
  loading,
  onRefresh,
}: {
  court: Court;
  availability: AvailabilityRow[];
  loading: boolean;
  onRefresh: () => void;
}) {
  const [savingDay, setSavingDay] = useState<number | null>(null);
  const [applyingAll, setApplyingAll] = useState(false);
  const [toast, setToast] = useState("");
  const [defaultOpen, setDefaultOpen] = useState("08:00");
  const [defaultClose, setDefaultClose] = useState("21:00");
  const [quickApplyError, setQuickApplyError] = useState("");

  const getAvailForDay = (day: DayOfWeek): AvailabilityRow | undefined =>
    availability.find((a) => a.day_of_week === day);

  const handleSaveDay = async (day: DayOfWeek, openTime: string, closeTime: string) => {
    if (closeTime <= openTime) return;
    setSavingDay(day);
    try {
      const supabase = createClient();
      const existing = getAvailForDay(day);
      if (existing) {
        const { error } = await supabase
          .from("court_availability")
          .update({ open_time: openTime, close_time: closeTime })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("court_availability").insert({
          court_id: court.id,
          day_of_week: day,
          open_time: openTime,
          close_time: closeTime,
        });
        if (error) throw error;
      }
      onRefresh();
      showToast("Saved");
    } catch (err) {
      console.error("Error saving day:", err);
      showToast("Error saving");
    } finally {
      setSavingDay(null);
    }
  };

  const handleRemoveDay = async (day: DayOfWeek) => {
    const existing = getAvailForDay(day);
    if (!existing) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.from("court_availability").delete().eq("id", existing.id);
      if (error) throw error;
      onRefresh();
      showToast("Removed");
    } catch (err) {
      console.error("Error removing day:", err);
    }
  };

  const handleApplyToAll = async () => {
    if (defaultClose <= defaultOpen) {
      setQuickApplyError("Close time must be after open time");
      return;
    }
    setQuickApplyError("");
    setApplyingAll(true);
    try {
      const supabase = createClient();
      await supabase.from("court_availability").delete().eq("court_id", court.id);
      const rows = Array.from({ length: 7 }, (_, i) => ({
        court_id: court.id,
        day_of_week: i,
        open_time: defaultOpen,
        close_time: defaultClose,
      }));
      const { error } = await supabase.from("court_availability").insert(rows);
      if (error) throw error;
      onRefresh();
      showToast("Applied to all days");
    } catch (err) {
      console.error("Error applying to all:", err);
      showToast("Error applying");
    } finally {
      setApplyingAll(false);
    }
  };

  const handleApplyWeekdays = async () => {
    if (defaultClose <= defaultOpen) {
      setQuickApplyError("Close time must be after open time");
      return;
    }
    setQuickApplyError("");
    setApplyingAll(true);
    try {
      const supabase = createClient();
      for (let d = 1; d <= 5; d++) {
        const existing = getAvailForDay(d as DayOfWeek);
        if (existing) {
          await supabase.from("court_availability").delete().eq("id", existing.id);
        }
      }
      const rows = Array.from({ length: 5 }, (_, i) => ({
        court_id: court.id,
        day_of_week: i + 1,
        open_time: defaultOpen,
        close_time: defaultClose,
      }));
      const { error } = await supabase.from("court_availability").insert(rows);
      if (error) throw error;
      onRefresh();
      showToast("Applied to weekdays");
    } catch (err) {
      console.error("Error:", err);
      showToast("Error applying");
    } finally {
      setApplyingAll(false);
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  };

  if (loading) {
    return (
      <div className="px-6 py-5">
        <Skeleton className="h-5 w-32 mb-4" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 mb-2" />)}
      </div>
    );
  }

  return (
    <div>
      {/* Section Header */}
      <div className="px-6 py-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">Operating Hours</h3>
          <p className="text-xs text-slate-500 mt-0.5">Set when this court is open for booking</p>
        </div>
        {toast && (
          <span className={`text-xs font-medium px-3 py-1 rounded-lg ${toast.includes("Error") ? "bg-error-light text-error" : "bg-success-light text-success"}`}>
            {toast}
          </span>
        )}
      </div>

      {/* Quick Apply */}
      <div className="px-6 py-3 bg-brand-surface border-y border-slate-100">
        <p className="text-xs font-medium text-slate-500 uppercase mb-3">Quick Apply</p>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={defaultOpen}
              onChange={(e) => { setDefaultOpen(e.target.value); setQuickApplyError(""); }}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
            />
            <span className="text-slate-400 text-sm">to</span>
            <input
              type="time"
              value={defaultClose}
              onChange={(e) => { setDefaultClose(e.target.value); setQuickApplyError(""); }}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
            />
          </div>
          <Button
            onClick={handleApplyToAll}
            disabled={applyingAll}
            loading={applyingAll}
          >
            {applyingAll ? "Applying..." : "All Days"}
          </Button>
          <Button
            variant="secondary"
            onClick={handleApplyWeekdays}
            disabled={applyingAll}
          >
            Weekdays Only
          </Button>
        </div>
        {quickApplyError && <p className="text-xs text-error mt-2">{quickApplyError}</p>}
      </div>

      {/* Day Grid */}
      <div className="divide-y divide-slate-100">
        {DAY_LABELS.map(({ short, full }, idx) => {
          const day = idx as DayOfWeek;
          const existing = getAvailForDay(day);
          return (
            <DayRowEditor
              key={day}
              dayIndex={day}
              dayShort={short}
              dayFull={full}
              existing={existing ?? null}
              saving={savingDay === day}
              onSave={(open, close) => handleSaveDay(day, open, close)}
              onRemove={() => handleRemoveDay(day)}
            />
          );
        })}
      </div>
    </div>
  );
}

/* ─── Day Row Editor ─── */

function DayRowEditor({
  dayIndex,
  dayShort,
  dayFull,
  existing,
  saving,
  onSave,
  onRemove,
}: {
  dayIndex: DayOfWeek;
  dayShort: string;
  dayFull: string;
  existing: AvailabilityRow | null;
  saving: boolean;
  onSave: (open: string, close: string) => void;
  onRemove: () => void;
}) {
  const [enabled, setEnabled] = useState(!!existing);
  const [open, setOpen] = useState(existing?.open_time ?? "08:00");
  const [close, setClose] = useState(existing?.close_time ?? "21:00");
  const [dirty, setDirty] = useState(false);
  const [timeError, setTimeError] = useState("");

  useEffect(() => {
    setEnabled(!!existing);
    if (existing) {
      setOpen(existing.open_time);
      setClose(existing.close_time);
    }
    setDirty(false);
    setTimeError("");
  }, [existing]);

  const handleToggle = () => {
    if (enabled && existing) {
      onRemove();
    } else if (!enabled) {
      setEnabled(true);
      setDirty(true);
      setTimeError("");
    }
  };

  const handleSave = () => {
    if (close <= open) {
      setTimeError("Close time must be after open time");
      return;
    }
    setTimeError("");
    onSave(open, close);
    setDirty(false);
  };

  const handleTimeChange = (field: "open" | "close", value: string) => {
    if (field === "open") setOpen(value);
    else setClose(value);
    setDirty(true);
    setTimeError("");
  };

  const isWeekend = dayIndex === 0 || dayIndex === 6;

  return (
    <div className={`px-6 py-3.5 ${existing ? "" : "opacity-60"}`}>
      <div className="flex items-center gap-4">
        <button
          onClick={handleToggle}
          className={`relative w-10 h-6 rounded-full transition-colors ${enabled ? "bg-brand" : "bg-slate-300"}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? "translate-x-4" : "translate-x-0"}`} />
        </button>
        <div className="w-28">
          <span className={`text-sm font-semibold ${isWeekend ? "text-slate-500" : "text-slate-900"}`}>
            {dayFull}
          </span>
        </div>
        {enabled ? (
          <>
            <input
              type="time"
              value={open}
              onChange={(e) => handleTimeChange("open", e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
            />
            <span className="text-slate-400 text-sm">–</span>
            <input
              type="time"
              value={close}
              onChange={(e) => handleTimeChange("close", e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
            />
            {dirty && (
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                loading={saving}
              >
                {saving ? "..." : "Save"}
              </Button>
            )}
            {existing && !dirty && (
              <span className="text-xs text-success font-medium">Saved</span>
            )}
          </>
        ) : (
          <span className="text-sm text-slate-400">Closed</span>
        )}
      </div>
      {timeError && (
        <p className="text-xs text-error mt-1.5 ml-[4.75rem]">{timeError}</p>
      )}
    </div>
  );
}
