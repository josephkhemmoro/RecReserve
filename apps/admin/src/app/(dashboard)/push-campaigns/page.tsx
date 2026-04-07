"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAdminClub } from "@/lib/useAdminClub";
import { PageHeader, Card, Button, Badge, FormInput, FormSelect, FormTextarea, EmptyState, Skeleton } from "@/components/ui";

interface Campaign {
  id: string;
  title: string;
  body: string;
  audience: string;
  sent_count: number;
  sent_at: string | null;
  created_at: string;
}

interface Tier {
  id: string;
  name: string;
}

const AUDIENCE_OPTIONS = [
  { value: "all", label: "All Members" },
  { value: "lapsed", label: "Lapsed (14+ days inactive)" },
  { value: "no_show", label: "No-Shows (last 30 days)" },
  { value: "tier", label: "Specific Tier" },
];

export default function PushCampaignsPage() {
  const { admin, loading: adminLoading } = useAdminClub();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", audience: "all", audience_tier_id: "" });
  const [result, setResult] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    if (!admin?.clubId) return;
    try {
      const supabase = createClient();
      const [campaignsRes, tiersRes] = await Promise.all([
        supabase.from("push_campaigns").select("*").eq("club_id", admin.clubId).order("created_at", { ascending: false }),
        supabase.from("membership_tiers").select("id, name").eq("club_id", admin.clubId),
      ]);
      setCampaigns(
        (campaignsRes.data ?? []).map((c) => ({
          id: c.id as string,
          title: c.title as string,
          body: c.body as string,
          audience: c.audience as string,
          sent_count: c.sent_count as number,
          sent_at: c.sent_at as string | null,
          created_at: c.created_at as string,
        }))
      );
      setTiers((tiersRes.data ?? []).map((t) => ({ id: t.id as string, name: t.name as string })));
    } catch (err) {
      console.error("Error fetching campaigns:", err);
    } finally {
      setLoading(false);
    }
  }, [admin?.clubId]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const handleSend = async () => {
    if (!admin?.clubId || !form.title.trim() || !form.body.trim()) return;
    setSending(true);
    setResult(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke("send-push-campaign", {
        body: {
          title: form.title.trim(),
          body: form.body.trim(),
          audience: form.audience,
          audience_tier_id: form.audience === "tier" ? form.audience_tier_id : null,
        },
      });

      if (error) throw error;
      setResult(`Campaign sent to ${data?.sent ?? 0} members`);
      setForm({ title: "", body: "", audience: "all", audience_tier_id: "" });
      setShowForm(false);
      fetchCampaigns();
    } catch (err) {
      console.error("Error sending campaign:", err);
      setResult("Failed to send campaign");
    } finally {
      setSending(false);
    }
  };

  const audienceLabel = (a: string) => {
    const opt = AUDIENCE_OPTIONS.find((o) => o.value === a);
    return opt?.label ?? a;
  };

  const isLoading = adminLoading || loading;

  return (
    <div>
      <PageHeader
        title="Push Campaigns"
        action={<Button onClick={() => setShowForm(true)}>New Campaign</Button>}
      />

      {result && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-teal-50 border border-teal-200 text-sm text-teal-800">
          {result}
        </div>
      )}

      {showForm && (
        <Card title="Send Push Notification" className="mb-6">
          <div className="space-y-4">
            <FormInput
              label="Title"
              value={form.title}
              onChange={(v) => setForm({ ...form, title: v })}
              placeholder="Come play this weekend!"
            />
            <FormTextarea
              label="Message"
              value={form.body}
              onChange={(v) => setForm({ ...form, body: v })}
              rows={3}
              placeholder="Your courts are waiting..."
            />
            <FormSelect
              label="Audience"
              value={form.audience}
              onChange={(v) => setForm({ ...form, audience: v })}
              options={AUDIENCE_OPTIONS}
            />
            {form.audience === "tier" && tiers.length > 0 && (
              <FormSelect
                label="Select Tier"
                value={form.audience_tier_id}
                onChange={(v) => setForm({ ...form, audience_tier_id: v })}
                options={[{ value: "", label: "Choose tier..." }, ...tiers.map((t) => ({ value: t.id, label: t.name }))]}
              />
            )}
          </div>
          <div className="flex gap-3 mt-4">
            <Button onClick={handleSend} disabled={sending || !form.title.trim() || !form.body.trim()} loading={sending}>
              {sending ? "Sending..." : "Send Campaign"}
            </Button>
            <Button variant="secondary" onClick={() => { setShowForm(false); setForm({ title: "", body: "", audience: "all", audience_tier_id: "" }); }}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      <Card title="Campaign History" noPadding>
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : campaigns.length === 0 ? (
          <EmptyState title="No campaigns sent yet" description="Send your first push notification campaign to engage members." />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Audience</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Sent To</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-6 py-3">
                    <p className="text-sm font-medium text-slate-900">{c.title}</p>
                    <p className="text-xs text-slate-500 truncate max-w-xs">{c.body}</p>
                  </td>
                  <td className="px-6 py-3">
                    <Badge label={audienceLabel(c.audience)} variant="default" />
                  </td>
                  <td className="px-6 py-3 text-sm text-slate-600">{c.sent_count} members</td>
                  <td className="px-6 py-3 text-sm text-slate-600">
                    {c.sent_at ? new Date(c.sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "---"}
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
