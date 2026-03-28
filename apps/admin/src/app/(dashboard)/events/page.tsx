"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAdminClub } from "@/lib/useAdminClub";
import type { EventType } from "@recreserve/shared";

interface ClubEvent {
  id: string;
  title: string;
  event_type: EventType;
  start_time: string;
  end_time: string;
  max_participants: number | null;
  price: number;
  description: string | null;
  registrant_count: number;
}

interface Registrant {
  id: string;
  status: string;
  user: { full_name: string; email: string } | null;
}

const EVENT_TYPES: EventType[] = ["open_play", "clinic", "tournament", "lesson"];

const EMPTY_FORM = {
  title: "",
  event_type: "open_play" as EventType,
  date: "",
  start_time: "09:00",
  end_time: "10:00",
  max_participants: "",
  description: "",
  price: "0",
};

export default function EventsPage() {
  const { admin, loading: adminLoading } = useAdminClub();
  const [events, setEvents] = useState<ClubEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [registrants, setRegistrants] = useState<Registrant[]>([]);
  const [loadingReg, setLoadingReg] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchEvents = useCallback(async (clubId: string) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("events")
        .select("id, title, event_type, start_time, end_time, max_participants, price, description")
        .eq("club_id", clubId)
        .order("start_time", { ascending: false });

      if (error) throw error;

      // Get registration counts
      const eventIds = (data ?? []).map((e: { id: string }) => e.id);
      let countMap = new Map<string, number>();

      if (eventIds.length > 0) {
        const { data: regs } = await supabase
          .from("event_registrations")
          .select("event_id")
          .in("event_id", eventIds)
          .eq("status", "registered");

        for (const r of regs ?? []) {
          const eid = r.event_id as string;
          countMap.set(eid, (countMap.get(eid) ?? 0) + 1);
        }
      }

      setEvents(
        (data ?? []).map((e: Record<string, unknown>) => ({
          id: e.id as string,
          title: e.title as string,
          event_type: e.event_type as EventType,
          start_time: e.start_time as string,
          end_time: e.end_time as string,
          max_participants: e.max_participants as number | null,
          price: e.price as number,
          description: e.description as string | null,
          registrant_count: countMap.get(e.id as string) ?? 0,
        }))
      );
    } catch (err) {
      console.error("Error fetching events:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (admin?.clubId) fetchEvents(admin.clubId);
  }, [admin?.clubId, fetchEvents]);

  const handleCreate = async () => {
    if (!admin?.clubId || !form.title.trim() || !form.date) return;
    setFormError("");

    // Validate date is not in the past
    const today = new Date().toISOString().split("T")[0];
    if (form.date < today) {
      setFormError("Event date cannot be in the past.");
      return;
    }

    // Validate end time is after start time
    if (form.end_time <= form.start_time) {
      setFormError("End time must be after start time.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("events").insert({
        club_id: admin.clubId,
        title: form.title.trim(),
        event_type: form.event_type,
        start_time: `${form.date}T${form.start_time}:00`,
        end_time: `${form.date}T${form.end_time}:00`,
        max_participants: form.max_participants ? Number(form.max_participants) : null,
        description: form.description || null,
        price: Number(form.price) || 0,
      });
      if (error) throw error;
      setShowForm(false);
      setForm(EMPTY_FORM);
      fetchEvents(admin.clubId);
    } catch (err) {
      console.error("Error creating event:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEvent = async (eventId: string) => {
    if (!admin?.clubId) return;
    try {
      const supabase = createClient();
      await supabase.from("events").delete().eq("id", eventId);
      fetchEvents(admin.clubId);
      if (selectedEventId === eventId) setSelectedEventId(null);
    } catch (err) {
      console.error("Error cancelling event:", err);
    }
  };

  const fetchRegistrants = async (eventId: string) => {
    if (selectedEventId === eventId) {
      setSelectedEventId(null);
      return;
    }
    setSelectedEventId(eventId);
    setLoadingReg(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("event_registrations")
        .select("id, status, user:users(full_name, email)")
        .eq("event_id", eventId)
        .order("created_at");
      if (error) throw error;
      setRegistrants(
        (data ?? []).map((r: Record<string, unknown>) => ({
          id: r.id as string,
          status: r.status as string,
          user: r.user as { full_name: string; email: string } | null,
        }))
      );
    } catch (err) {
      console.error("Error fetching registrants:", err);
    } finally {
      setLoadingReg(false);
    }
  };

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  const formatEventType = (t: string) => t.replace("_", " ");

  const isLoading = adminLoading || loading;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Events</h1>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Create Event
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">New Event</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Open Play Night"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
              <select
                value={form.event_type}
                onChange={(e) => setForm({ ...form, event_type: e.target.value as EventType })}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t} className="capitalize">{formatEventType(t)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Start</label>
                <input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">End</label>
                <input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Max Participants</label>
              <input type="number" min="0" value={form.max_participants} onChange={(e) => setForm({ ...form, max_participants: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Leave blank for unlimited" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Price ($)</label>
              <input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mt-4 text-sm">
              {formError}
            </div>
          )}
          <div className="flex gap-3 mt-4">
            <button onClick={handleCreate} disabled={saving || !form.title.trim() || !form.date} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Creating..." : "Create Event"}
            </button>
            <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setFormError(""); }} className="px-4 py-2 text-slate-600 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200">
        {isLoading ? (
          <div className="p-6 space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-slate-100 rounded" />)}
          </div>
        ) : events.length === 0 ? (
          <div className="p-10 text-center text-slate-500">No events yet</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date & Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Registered</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Price</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <>
                  <tr key={ev.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-6 py-3 text-sm font-medium text-slate-900">{ev.title}</td>
                    <td className="px-6 py-3 text-sm text-slate-600 capitalize">{formatEventType(ev.event_type)}</td>
                    <td className="px-6 py-3 text-sm text-slate-600">{formatDateTime(ev.start_time)}</td>
                    <td className="px-6 py-3 text-sm text-slate-600">
                      {ev.registrant_count}{ev.max_participants ? ` / ${ev.max_participants}` : ""}
                    </td>
                    <td className="px-6 py-3 text-sm text-slate-600">
                      {Number(ev.price) > 0 ? `$${Number(ev.price).toFixed(2)}` : "Free"}
                    </td>
                    <td className="px-6 py-3 text-right space-x-2">
                      <button
                        onClick={() => fetchRegistrants(ev.id)}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {selectedEventId === ev.id ? "Hide" : "Registrants"}
                      </button>
                      <button
                        onClick={() => handleCancelEvent(ev.id)}
                        className="text-sm text-red-600 hover:text-red-800 font-medium"
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                  {selectedEventId === ev.id && (
                    <tr key={`${ev.id}-reg`}>
                      <td colSpan={6} className="bg-slate-50 px-6 py-4">
                        {loadingReg ? (
                          <p className="text-sm text-slate-500">Loading registrants...</p>
                        ) : registrants.length === 0 ? (
                          <p className="text-sm text-slate-500">No registrants yet</p>
                        ) : (
                          <div className="space-y-1">
                            {registrants.map((r) => (
                              <div key={r.id} className="flex items-center justify-between text-sm">
                                <span className="text-slate-900">{r.user?.full_name ?? r.user?.email ?? "—"}</span>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  r.status === "registered" ? "bg-green-50 text-green-700"
                                    : r.status === "waitlisted" ? "bg-amber-50 text-amber-700"
                                    : "bg-slate-100 text-slate-500"
                                }`}>
                                  {r.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
