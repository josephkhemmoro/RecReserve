"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAdminClub } from "@/lib/useAdminClub";
import { PageHeader, Card, Badge, FormInput, FormSelect, EmptyState, Skeleton } from "@/components/ui";

interface CommEntry {
  id: string; channel: string; subject: string | null; body: string;
  trigger_type: string; trigger_source: string | null;
  entity_type: string | null; status: string; sent_at: string;
  recipient_name: string | null; recipient_email: string | null;
}

const CHANNEL_VARIANT: Record<string, "brand" | "success" | "warning" | "info" | "default"> = {
  push: "brand", email: "info", sms: "success", in_app: "default",
};

const STATUS_VARIANT: Record<string, "brand" | "success" | "warning" | "error" | "default"> = {
  pending: "warning", sent: "success", delivered: "success", failed: "error", bounced: "error",
};

const CHANNEL_OPTIONS = [
  { value: "all", label: "All Channels" }, { value: "push", label: "Push" },
  { value: "email", label: "Email" }, { value: "in_app", label: "In-App" },
];

const TRIGGER_OPTIONS = [
  { value: "all", label: "All Triggers" }, { value: "manual", label: "Manual" },
  { value: "automated", label: "Automated" }, { value: "system", label: "System" },
];

export default function CommunicationsPage() {
  const { admin, loading: adminLoading } = useAdminClub();
  const [entries, setEntries] = useState<CommEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState("all");
  const [triggerFilter, setTriggerFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");

  const fetchData = useCallback(async () => {
    if (!admin?.clubId) return;
    setLoading(true);
    try {
      const supabase = createClient();
      let query = supabase.from("communication_log")
        .select("id, channel, subject, body, trigger_type, trigger_source, entity_type, status, sent_at, recipient:users!communication_log_recipient_id_fkey(full_name, email)")
        .eq("club_id", admin.clubId).order("sent_at", { ascending: false }).limit(200);

      if (channelFilter !== "all") query = query.eq("channel", channelFilter);
      if (triggerFilter !== "all") query = query.eq("trigger_type", triggerFilter);
      if (dateFrom) query = query.gte("sent_at", `${dateFrom}T00:00:00`);

      const { data, error } = await query;
      if (error) throw error;

      setEntries((data ?? []).map((e) => {
        const recipient = e.recipient as { full_name: string; email: string } | null;
        return {
          id: e.id as string, channel: e.channel as string,
          subject: e.subject as string | null, body: e.body as string,
          trigger_type: e.trigger_type as string, trigger_source: e.trigger_source as string | null,
          entity_type: e.entity_type as string | null, status: e.status as string,
          sent_at: e.sent_at as string,
          recipient_name: recipient?.full_name ?? null,
          recipient_email: recipient?.email ?? null,
        };
      }));
    } catch (err) { console.error("Error:", err); }
    finally { setLoading(false); }
  }, [admin?.clubId, channelFilter, triggerFilter, dateFrom]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const formatTime = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const isLoading = adminLoading || loading;

  return (
    <div>
      <PageHeader title="Communication History" />

      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <FormSelect label="Channel" value={channelFilter} onChange={setChannelFilter} options={CHANNEL_OPTIONS} />
          <FormSelect label="Trigger" value={triggerFilter} onChange={setTriggerFilter} options={TRIGGER_OPTIONS} />
          <FormInput label="From Date" type="date" value={dateFrom} onChange={setDateFrom} />
        </div>
      </Card>

      <Card noPadding>
        {isLoading ? (<div className="p-6 space-y-3">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>)
        : entries.length === 0 ? (<EmptyState title="No communications yet" description="Messages sent to members will appear here." />)
        : (
          <table className="w-full">
            <thead><tr className="border-b border-slate-100">
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Recipient</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Channel</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Subject</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Trigger</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Status</th>
            </tr></thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-6 py-3 text-sm text-slate-600 whitespace-nowrap">{formatTime(e.sent_at)}</td>
                  <td className="px-6 py-3">
                    <p className="text-sm font-medium text-slate-900">{e.recipient_name ?? "Broadcast"}</p>
                    {e.recipient_email && <p className="text-xs text-slate-400">{e.recipient_email}</p>}
                  </td>
                  <td className="px-6 py-3"><Badge label={e.channel} variant={CHANNEL_VARIANT[e.channel] ?? "default"} /></td>
                  <td className="px-6 py-3 text-sm text-slate-600 max-w-xs truncate">{e.subject || e.body.slice(0, 60)}</td>
                  <td className="px-6 py-3 text-sm text-slate-500">
                    {e.trigger_type}{e.trigger_source ? ` · ${e.trigger_source.replace(/_/g, " ")}` : ""}
                  </td>
                  <td className="px-6 py-3"><Badge label={e.status} variant={STATUS_VARIANT[e.status] ?? "default"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
