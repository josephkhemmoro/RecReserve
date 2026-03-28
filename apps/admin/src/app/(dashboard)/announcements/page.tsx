"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAdminClub } from "@/lib/useAdminClub";

interface Tier {
  id: string;
  name: string;
  color: string | null;
}

interface HistoryItem {
  title: string;
  body: string;
  sent_at: string;
  recipient_count: number;
}

type Audience = "all" | "tier";

interface ComposeForm {
  title: string;
  message: string;
  audience: Audience;
  tier_id: string;
  send_push: boolean;
  send_in_app: boolean;
}

const EMPTY_FORM: ComposeForm = {
  title: "",
  message: "",
  audience: "all",
  tier_id: "",
  send_push: true,
  send_in_app: true,
};

export default function AnnouncementsPage() {
  const { admin, loading: adminLoading } = useAdminClub();

  // Compose state
  const [form, setForm] = useState<ComposeForm>(EMPTY_FORM);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sendResult, setSendResult] = useState<{
    recipients: number;
    push_sent: number;
    push_failed: number;
  } | null>(null);

  // Tier list
  const [tiers, setTiers] = useState<Tier[]>([]);

  // History
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const fetchTiers = useCallback(async (clubId: string) => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("membership_tiers")
        .select("id, name, color")
        .eq("club_id", clubId)
        .order("name");

      setTiers(
        (data ?? []).map((t: Record<string, unknown>) => ({
          id: t.id as string,
          name: t.name as string,
          color: t.color as string | null,
        }))
      );
    } catch (err) {
      console.error("Error fetching tiers:", err);
    }
  }, []);

  const fetchHistory = useCallback(async (clubId: string) => {
    setHistoryLoading(true);
    try {
      const supabase = createClient();

      // Get all announcement notifications for users in this club.
      // We need club members first, then their announcement notifications.
      const { data: members } = await supabase
        .from("users")
        .select("id")
        .eq("club_id", clubId);

      const memberIds = (members ?? []).map((m: { id: string }) => m.id);

      if (memberIds.length === 0) {
        setHistory([]);
        setHistoryLoading(false);
        return;
      }

      const { data: notifications, error } = await supabase
        .from("notifications")
        .select("title, body, created_at")
        .eq("type", "announcement")
        .in("user_id", memberIds)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Group by title + created_at minute to deduplicate batch inserts
      const groups = new Map<string, { title: string; body: string; sent_at: string; count: number }>();

      for (const n of notifications ?? []) {
        const title = n.title as string;
        const body = n.body as string;
        const created = n.created_at as string;
        // Round to the nearest minute to group batch inserts together
        const minuteKey = created.slice(0, 16);
        const key = `${title}::${minuteKey}`;

        const existing = groups.get(key);
        if (existing) {
          existing.count++;
        } else {
          groups.set(key, { title, body, sent_at: created, count: 1 });
        }
      }

      setHistory(
        Array.from(groups.values()).map((g) => ({
          title: g.title,
          body: g.body,
          sent_at: g.sent_at,
          recipient_count: g.count,
        }))
      );
    } catch (err) {
      console.error("Error fetching history:", err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (admin?.clubId) {
      fetchTiers(admin.clubId);
      fetchHistory(admin.clubId);
    }
  }, [admin?.clubId, fetchTiers, fetchHistory]);

  const canSend =
    form.title.trim().length > 0 &&
    form.message.trim().length > 0 &&
    (form.send_push || form.send_in_app) &&
    (form.audience !== "tier" || form.tier_id !== "");

  const handleSend = async () => {
    if (!admin?.clubId || !canSend) return;
    setSending(true);
    setSendError("");
    setSendResult(null);

    try {
      const supabase = createClient();
      const clubId = admin.clubId;
      const clubName = admin.clubName;
      const title = clubName ? `${clubName} - ${form.title.trim()}` : form.title.trim();
      const message = form.message.trim();

      // Get target users
      let userIds: string[] | null = null;

      if (form.audience === "tier" && form.tier_id) {
        const { data: memberships } = await supabase
          .from("memberships")
          .select("user_id")
          .eq("club_id", clubId)
          .eq("tier_id", form.tier_id)
          .eq("is_active", true);

        userIds = (memberships ?? []).map((m: { user_id: string }) => m.user_id);

        if (userIds.length === 0) {
          setSendResult({ recipients: 0, push_sent: 0, push_failed: 0 });
          return;
        }
      }

      let usersQuery = supabase
        .from("users")
        .select("id, push_token")
        .eq("club_id", clubId);

      if (userIds) {
        usersQuery = usersQuery.in("id", userIds);
      }

      const { data: users, error: usersError } = await usersQuery;
      if (usersError) throw usersError;

      const recipients = users ?? [];

      // Insert in-app notifications
      if (form.send_in_app && recipients.length > 0) {
        const rows = recipients.map((u: { id: string }) => ({
          user_id: u.id,
          title,
          body: message,
          type: "announcement",
          read: false,
        }));

        const { error: insertError } = await supabase
          .from("notifications")
          .insert(rows);

        if (insertError) {
          console.error("Error inserting notifications:", insertError);
        }
      }

      // Send push notifications via Expo
      let pushSent = 0;
      let pushFailed = 0;

      if (form.send_push) {
        const tokens = recipients
          .filter((u: { id: string; push_token: string | null }) => u.push_token)
          .map((u: { id: string; push_token: string | null }) => u.push_token!);

        for (let i = 0; i < tokens.length; i += 100) {
          const batch = tokens.slice(i, i + 100);
          const pushMessages = batch.map((token: string) => ({
            to: token,
            title,
            body: message,
            data: { type: "announcement" },
            sound: "default",
          }));

          try {
            const response = await fetch("/api/push", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ messages: pushMessages }),
            });

            if (response.ok) {
              pushSent += batch.length;
            } else {
              pushFailed += batch.length;
              console.error("Expo push failed:", await response.text());
            }
          } catch (err) {
            pushFailed += batch.length;
            console.error("Push error:", err);
          }
        }
      }

      setSendResult({
        recipients: recipients.length,
        push_sent: pushSent,
        push_failed: pushFailed,
      });
      setForm(EMPTY_FORM);
      fetchHistory(admin.clubId);
    } catch (err) {
      console.error("Error sending announcement:", err);
      setSendError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  };

  const formatTimestamp = (iso: string) =>
    new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  const isLoading = adminLoading;

  if (isLoading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-8">Announcements</h1>
        <div className="max-w-3xl space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse">
            <div className="h-5 w-40 bg-slate-200 rounded mb-4" />
            <div className="space-y-3">
              <div className="h-10 bg-slate-100 rounded-lg" />
              <div className="h-24 bg-slate-100 rounded-lg" />
              <div className="h-10 bg-slate-100 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Announcements</h1>
        <p className="text-sm text-slate-500 mt-1">
          Send push and in-app notifications to your members
        </p>
      </div>

      <div className="max-w-3xl space-y-8">
        {/* Compose Form */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Compose Announcement
          </h2>

          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) =>
                  setForm({ ...form, title: e.target.value.slice(0, 100) })
                }
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Court Maintenance Notice"
                maxLength={100}
              />
              <p className="text-xs text-slate-400 mt-1 text-right">
                {form.title.length}/100
              </p>
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Message *
              </label>
              <textarea
                value={form.message}
                onChange={(e) =>
                  setForm({ ...form, message: e.target.value.slice(0, 500) })
                }
                rows={4}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Write your announcement message..."
                maxLength={500}
              />
              <p
                className={`text-xs mt-1 text-right ${
                  form.message.length > 480
                    ? "text-amber-600"
                    : "text-slate-400"
                }`}
              >
                {form.message.length}/500
              </p>
            </div>

            {/* Audience */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Audience
              </label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="audience"
                    checked={form.audience === "all"}
                    onChange={() =>
                      setForm({ ...form, audience: "all", tier_id: "" })
                    }
                    className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">All members</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="audience"
                    checked={form.audience === "tier"}
                    onChange={() => setForm({ ...form, audience: "tier" })}
                    className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">Specific tier</span>
                </label>
                {form.audience === "tier" && (
                  <select
                    value={form.tier_id}
                    onChange={(e) =>
                      setForm({ ...form, tier_id: e.target.value })
                    }
                    className="ml-6 w-64 px-3 py-2 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a tier...</option>
                    {tiers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Delivery Method */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Delivery Method
                <span className="text-xs font-normal text-slate-400 ml-1">
                  (at least one required)
                </span>
              </label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.send_push}
                    onChange={(e) =>
                      setForm({ ...form, send_push: e.target.checked })
                    }
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">
                    Push notification
                  </span>
                  <span className="text-xs text-slate-400">
                    — sends to members&apos; devices via Expo Push
                  </span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.send_in_app}
                    onChange={(e) =>
                      setForm({ ...form, send_in_app: e.target.checked })
                    }
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700">
                    In-app notification
                  </span>
                  <span className="text-xs text-slate-400">
                    — appears in each member&apos;s notification inbox
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Error */}
          {sendError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mt-4 text-sm">
              {sendError}
            </div>
          )}

          {/* Success */}
          {sendResult && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mt-4 text-sm">
              <p className="font-medium">Announcement sent!</p>
              <p className="mt-0.5">
                {sendResult.recipients} recipient
                {sendResult.recipients !== 1 ? "s" : ""}
                {sendResult.push_sent > 0 &&
                  ` · ${sendResult.push_sent} push delivered`}
                {sendResult.push_failed > 0 &&
                  ` · ${sendResult.push_failed} push failed`}
              </p>
            </div>
          )}

          {/* Send Button */}
          <div className="mt-5">
            <button
              onClick={handleSend}
              disabled={!canSend || sending}
              className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {sending && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              )}
              {sending ? "Sending..." : "Send Announcement"}
            </button>
          </div>
        </div>

        {/* History */}
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">
              Past Announcements
            </h2>
          </div>

          {historyLoading ? (
            <div className="p-6 space-y-3 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-slate-100 rounded-lg" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <div className="p-10 text-center">
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-7 h-7 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-1">
                No announcements yet
              </h3>
              <p className="text-sm text-slate-500">
                Send your first announcement to notify your members.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {history.map((item, idx) => (
                <div key={idx} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-slate-900 truncate">
                        {item.title}
                      </h3>
                      <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">
                        {item.body}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-slate-400">
                        {formatTimestamp(item.sent_at)}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {item.recipient_count} recipient
                        {item.recipient_count !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
