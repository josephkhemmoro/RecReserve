"use client";

import React, { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAdminClub } from "@/lib/useAdminClub";
import type { EventType } from "@recreserve/shared";
import { localDateStr } from "@/lib/dateUtils";
import { PageHeader, Card, Button, Badge, FormInput, FormSelect, FormTextarea, EmptyState, Skeleton } from "@/components/ui";

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

const EVENT_TYPE_OPTIONS = EVENT_TYPES.map((t) => ({
  value: t,
  label: t.replace("_", " "),
}));

const EVENT_TYPE_BADGE_VARIANT: Record<string, "brand" | "success" | "warning" | "info" | "default"> = {
  open_play: "brand",
  clinic: "success",
  tournament: "warning",
  lesson: "info",
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
    const today = localDateStr();
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
      <PageHeader
        title="Events"
        action={
          <Button onClick={() => setShowForm(true)}>Create Event</Button>
        }
      />

      {showForm && (
        <Card title="New Event" className="mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput
              label="Title"
              value={form.title}
              onChange={(v) => setForm({ ...form, title: v })}
              placeholder="Open Play Night"
            />
            <FormSelect
              label="Type"
              value={form.event_type}
              onChange={(v) => setForm({ ...form, event_type: v as EventType })}
              options={EVENT_TYPE_OPTIONS}
            />
            <FormInput
              label="Date"
              type="date"
              value={form.date}
              onChange={(v) => setForm({ ...form, date: v })}
            />
            <div className="flex gap-2">
              <FormInput
                label="Start"
                type="time"
                value={form.start_time}
                onChange={(v) => setForm({ ...form, start_time: v })}
                className="flex-1"
              />
              <FormInput
                label="End"
                type="time"
                value={form.end_time}
                onChange={(v) => setForm({ ...form, end_time: v })}
                className="flex-1"
              />
            </div>
            <FormInput
              label="Max Participants"
              type="number"
              min={0}
              value={form.max_participants}
              onChange={(v) => setForm({ ...form, max_participants: v })}
              placeholder="Leave blank for unlimited"
            />
            <FormInput
              label="Price ($)"
              type="number"
              min={0}
              step={0.01}
              value={form.price}
              onChange={(v) => setForm({ ...form, price: v })}
            />
            <FormTextarea
              label="Description"
              value={form.description}
              onChange={(v) => setForm({ ...form, description: v })}
              rows={2}
              className="sm:col-span-2"
            />
          </div>
          {formError && (
            <div className="bg-error-light border border-red-200 text-error px-4 py-3 rounded-lg mt-4 text-sm">
              {formError}
            </div>
          )}
          <div className="flex gap-3 mt-4">
            <Button
              onClick={handleCreate}
              disabled={saving || !form.title.trim() || !form.date}
              loading={saving}
            >
              {saving ? "Creating..." : "Create Event"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setFormError(""); }}
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}

      <Card noPadding>
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : events.length === 0 ? (
          <EmptyState title="No events yet" description="Create your first event to get started." />
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
                <React.Fragment key={ev.id}>
                  <tr className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-6 py-3 text-sm font-medium text-slate-900">{ev.title}</td>
                    <td className="px-6 py-3">
                      <Badge
                        label={formatEventType(ev.event_type)}
                        variant={EVENT_TYPE_BADGE_VARIANT[ev.event_type] ?? "default"}
                      />
                    </td>
                    <td className="px-6 py-3 text-sm text-slate-600">{formatDateTime(ev.start_time)}</td>
                    <td className="px-6 py-3 text-sm text-slate-600">
                      {ev.registrant_count}{ev.max_participants ? ` / ${ev.max_participants}` : ""}
                    </td>
                    <td className="px-6 py-3 text-sm text-slate-600">
                      {Number(ev.price) > 0 ? `$${Number(ev.price).toFixed(2)}` : "Free"}
                    </td>
                    <td className="px-6 py-3 text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => fetchRegistrants(ev.id)}
                      >
                        {selectedEventId === ev.id ? "Hide" : "Registrants"}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleCancelEvent(ev.id)}
                      >
                        Cancel
                      </Button>
                    </td>
                  </tr>
                  {selectedEventId === ev.id && (
                    <tr key={`${ev.id}-reg`}>
                      <td colSpan={6} className="bg-brand-surface px-6 py-4">
                        {loadingReg ? (
                          <p className="text-sm text-slate-500">Loading registrants...</p>
                        ) : registrants.length === 0 ? (
                          <p className="text-sm text-slate-500">No registrants yet</p>
                        ) : (
                          <div className="space-y-1">
                            {registrants.map((r) => (
                              <div key={r.id} className="flex items-center justify-between text-sm">
                                <span className="text-slate-900">{r.user?.full_name ?? r.user?.email ?? "—"}</span>
                                <Badge
                                  label={r.status}
                                  variant={
                                    r.status === "registered" ? "success"
                                      : r.status === "waitlisted" ? "warning"
                                      : "default"
                                  }
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
