"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAdminClub } from "@/lib/useAdminClub";
import type { Sport, DayOfWeek } from "@recreserve/shared";

interface Court {
  id: string;
  name: string;
  sport: Sport;
  is_active: boolean;
  hourly_rate: number;
  is_free: boolean;
}

interface CourtForm {
  name: string;
  sport: Sport;
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

const EMPTY_FORM: CourtForm = { name: "", sport: "tennis", hourly_rate: 0, is_free: false };

export default function CourtsPage() {
  const { admin, loading: adminLoading } = useAdminClub();
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CourtForm>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedCourtId, setSelectedCourtId] = useState<string | null>(null);
  const [availability, setAvailability] = useState<AvailabilityRow[]>([]);
  const [loadingAvail, setLoadingAvail] = useState(false);

  const fetchCourts = useCallback(async (clubId: string) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("courts")
        .select("id, name, sport, is_active, hourly_rate, is_free")
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

  const handleSave = async () => {
    if (!admin?.clubId || !form.name.trim()) return;

    // Validate rate
    if (!form.is_free && form.hourly_rate < 0) {
      setFormError("Hourly rate cannot be negative");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const supabase = createClient();
      const payload = {
        name: form.name.trim(),
        sport: form.sport,
        hourly_rate: form.is_free ? 0 : form.hourly_rate,
        is_free: form.is_free,
      };

      if (editingId) {
        const { error } = await supabase
          .from("courts")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("courts").insert({
          club_id: admin.clubId,
          ...payload,
          is_active: true,
        });
        if (error) throw error;
      }
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      setFormError("");
      fetchCourts(admin.clubId);
    } catch (err) {
      console.error("Error saving court:", err);
      setFormError(err instanceof Error ? err.message : "Failed to save court");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (court: Court) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("courts")
        .update({ is_active: !court.is_active })
        .eq("id", court.id);
      if (error) throw error;
      if (admin?.clubId) fetchCourts(admin.clubId);
    } catch (err) {
      console.error("Error toggling court:", err);
    }
  };

  const startEdit = (court: Court) => {
    setEditingId(court.id);
    setForm({
      name: court.name,
      sport: court.sport,
      hourly_rate: court.hourly_rate,
      is_free: court.is_free,
    });
    setFormError("");
    setShowForm(true);
  };

  const fetchAvailability = async (courtId: string) => {
    setLoadingAvail(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("court_availability")
        .select("*")
        .eq("court_id", courtId)
        .order("day_of_week");
      if (error) throw error;
      setAvailability((data ?? []) as AvailabilityRow[]);
    } catch (err) {
      console.error("Error fetching availability:", err);
    } finally {
      setLoadingAvail(false);
    }
  };

  const handleSelectCourt = (courtId: string) => {
    if (selectedCourtId === courtId) {
      setSelectedCourtId(null);
    } else {
      setSelectedCourtId(courtId);
      fetchAvailability(courtId);
    }
  };

  const isLoading = adminLoading || loading;
  const selectedCourt = courts.find((c) => c.id === selectedCourtId);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Courts</h1>
        <button
          onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setFormError(""); setShowForm(true); }}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Add Court
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            {editingId ? "Edit Court" : "New Court"}
          </h2>

          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Court 1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sport</label>
              <select
                value={form.sport}
                onChange={(e) => setForm({ ...form, sport: e.target.value as Sport })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="tennis">Tennis</option>
                <option value="pickleball">Pickleball</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Hourly Rate ($)
              </label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.is_free ? "" : form.hourly_rate}
                onChange={(e) =>
                  setForm({ ...form, hourly_rate: Math.max(0, Number(e.target.value)) })
                }
                disabled={form.is_free}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                placeholder="0.00"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-3 cursor-pointer py-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, is_free: !form.is_free })}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    form.is_free ? "bg-green-600" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      form.is_free ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
                <span className="text-sm font-medium text-slate-700">
                  Free court (no payment required)
                </span>
              </label>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={handleSave} disabled={saving || !form.name.trim()} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saving..." : editingId ? "Update" : "Create"}
            </button>
            <button onClick={() => { setShowForm(false); setEditingId(null); setFormError(""); }} className="px-4 py-2 text-slate-600 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Courts Table */}
      <div className="bg-white rounded-xl border border-slate-200 mb-6">
        {isLoading ? (
          <div className="p-6 space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-slate-100 rounded" />)}
          </div>
        ) : courts.length === 0 ? (
          <div className="p-10 text-center text-slate-500">No courts yet. Add your first court above.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Sport</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {courts.map((court) => (
                <tr key={court.id} className={`border-b border-slate-50 hover:bg-slate-50/50 ${selectedCourtId === court.id ? "bg-blue-50/50" : ""}`}>
                  <td className="px-6 py-3 text-sm font-medium text-slate-900">{court.name}</td>
                  <td className="px-6 py-3 text-sm text-slate-600 capitalize">{court.sport}</td>
                  <td className="px-6 py-3">
                    {court.is_free ? (
                      <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold bg-green-50 text-green-700">
                        Free
                      </span>
                    ) : (
                      <span className="text-sm font-medium text-slate-900">
                        ${court.hourly_rate.toFixed(2)}/hr
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold ${court.is_active ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                      {court.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right space-x-3">
                    <button onClick={() => startEdit(court)} className="text-sm text-blue-600 hover:text-blue-800 font-medium">Edit</button>
                    <button onClick={() => handleToggleActive(court)} className={`text-sm font-medium ${court.is_active ? "text-amber-600 hover:text-amber-800" : "text-green-600 hover:text-green-800"}`}>
                      {court.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button onClick={() => handleSelectCourt(court.id)} className={`text-sm font-medium ${selectedCourtId === court.id ? "text-blue-700" : "text-slate-600 hover:text-slate-800"}`}>
                      {selectedCourtId === court.id ? "Close Hours" : "Set Hours"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Availability Panel */}
      {selectedCourtId && selectedCourt && (
        <AvailabilityPanel
          court={selectedCourt}
          availability={availability}
          loading={loadingAvail}
          onRefresh={() => fetchAvailability(selectedCourtId)}
        />
      )}
    </div>
  );
}

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
    if (closeTime <= openTime) return; // validated in DayRowEditor
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
      const { error } = await supabase
        .from("court_availability")
        .delete()
        .eq("id", existing.id);
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

      await supabase
        .from("court_availability")
        .delete()
        .eq("court_id", court.id);

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
      <div className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse">
        <div className="h-6 w-48 bg-slate-100 rounded mb-4" />
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="h-12 bg-slate-50 rounded mb-2" />
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Hours for {court.name}
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Set when this court is open for booking
          </p>
        </div>
        {toast && (
          <span className={`text-sm font-medium px-3 py-1 rounded-lg ${toast.includes("Error") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"}`}>
            {toast}
          </span>
        )}
      </div>

      {/* Quick Apply */}
      <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
        <p className="text-xs font-medium text-slate-500 uppercase mb-3">Quick Apply</p>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={defaultOpen}
              onChange={(e) => { setDefaultOpen(e.target.value); setQuickApplyError(""); }}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-slate-400 text-sm">to</span>
            <input
              type="time"
              value={defaultClose}
              onChange={(e) => { setDefaultClose(e.target.value); setQuickApplyError(""); }}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={handleApplyToAll}
            disabled={applyingAll}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {applyingAll ? "Applying..." : "Apply to All Days"}
          </button>
          <button
            onClick={handleApplyWeekdays}
            disabled={applyingAll}
            className="px-4 py-2 bg-white text-slate-700 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            Weekdays Only
          </button>
        </div>
        {quickApplyError && (
          <p className="text-xs text-red-600 mt-2">{quickApplyError}</p>
        )}
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

  // Sync with props when availability refreshes
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
        {/* Toggle */}
        <button
          onClick={handleToggle}
          className={`relative w-10 h-6 rounded-full transition-colors ${
            enabled ? "bg-blue-600" : "bg-slate-300"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              enabled ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>

        {/* Day label */}
        <div className="w-28">
          <span className={`text-sm font-semibold ${isWeekend ? "text-slate-500" : "text-slate-900"}`}>
            {dayFull}
          </span>
        </div>

        {/* Time inputs */}
        {enabled ? (
          <>
            <input
              type="time"
              value={open}
              onChange={(e) => handleTimeChange("open", e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-slate-400 text-sm">–</span>
            <input
              type="time"
              value={close}
              onChange={(e) => handleTimeChange("close", e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {dirty && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {saving ? "..." : "Save"}
              </button>
            )}

            {existing && !dirty && (
              <span className="text-xs text-green-600 font-medium">Saved</span>
            )}
          </>
        ) : (
          <span className="text-sm text-slate-400">Closed</span>
        )}
      </div>

      {/* Time validation error */}
      {timeError && (
        <p className="text-xs text-red-600 mt-1.5 ml-[4.75rem]">{timeError}</p>
      )}
    </div>
  );
}
