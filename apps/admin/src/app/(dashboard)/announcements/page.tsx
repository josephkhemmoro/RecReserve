"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAdminClub } from "@/lib/useAdminClub";
import { PageHeader, Card, Button, Badge, FormInput, FormTextarea, FormSelect, Skeleton } from "@/components/ui";

interface Tier {
  id: string;
  name: string;
  color: string | null;
}

interface HistoryItem {
  id: string;
  title: string;
  body: string;
  sent_at: string;
  audience: string;
  image_url: string | null;
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

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

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

  // Image attachment
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

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

      const { data, error } = await supabase
        .from("club_announcements")
        .select("id, title, body, audience, image_url, created_at")
        .eq("club_id", clubId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      setHistory(
        (data ?? []).map((a: { id: string; title: string; body: string; audience: string; image_url: string | null; created_at: string }) => ({
          id: a.id,
          title: a.title,
          body: a.body,
          sent_at: a.created_at,
          audience: a.audience,
          image_url: a.image_url,
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
      const clubName = admin.clubName || "";
      const title = form.title.trim();
      const pushTitle = clubName ? `${clubName}: ${title}` : title;
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

      // Upload image if attached
      let imageUrl: string | null = null;
      if (imageFile) {
        setImageUploading(true);
        const ext = imageFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const filePath = `${clubId}/announcements/${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("club-assets")
          .upload(filePath, imageFile, { upsert: false });

        if (uploadError) {
          console.error("Image upload error:", uploadError);
        } else {
          const { data: urlData } = supabase.storage
            .from("club-assets")
            .getPublicUrl(filePath);
          imageUrl = urlData.publicUrl;
        }
        setImageUploading(false);
      }

      // Store master announcement record for club profile page
      const { data: sessionData } = await supabase.auth.getSession();
      const { error: annError } = await supabase
        .from("club_announcements")
        .insert({
          club_id: clubId,
          title,
          body: message,
          audience: form.audience === "tier" && form.tier_id ? form.tier_id : "all",
          image_url: imageUrl,
          created_by: sessionData?.session?.user?.id ?? null,
        });

      if (annError) {
        console.error("Error inserting club announcement:", annError);
      }

      // Insert in-app notifications
      if (form.send_in_app && recipients.length > 0) {
        const rows = recipients.map((u: { id: string }) => ({
          user_id: u.id,
          club_id: clubId,
          title,
          body: message,
          type: "announcement",
          image_url: imageUrl,
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
            title: pushTitle,
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
      setImageFile(null);
      setImagePreview(null);
      if (imageInputRef.current) imageInputRef.current.value = "";
      fetchHistory(admin.clubId);
    } catch (err) {
      console.error("Error sending announcement:", err);
      setSendError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  };

  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);

  const handleDeleteAnnouncement = async (item: HistoryItem) => {
    if (!admin?.clubId) return;
    setDeletingKey(item.id);
    try {
      const supabase = createClient();

      // Delete the master announcement record
      const { error } = await supabase
        .from("club_announcements")
        .delete()
        .eq("id", item.id);

      if (error) throw error;

      // Also delete the per-user notifications for this announcement
      await supabase
        .from("notifications")
        .delete()
        .eq("club_id", admin.clubId)
        .eq("type", "announcement")
        .eq("title", item.title)
        .eq("body", item.body);

      setConfirmDeleteKey(null);
      fetchHistory(admin.clubId);
    } catch (err) {
      console.error("Error deleting announcement:", err);
    } finally {
      setDeletingKey(null);
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
        <PageHeader title="Announcements" subtitle="Send push and in-app notifications to your members" />
        <div className="max-w-3xl space-y-6">
          <Card>
            <div className="space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Announcements"
        subtitle="Send push and in-app notifications to your members"
      />

      <div className="max-w-3xl space-y-8">
        {/* Compose Form */}
        <Card title="Compose Announcement">
          <div className="space-y-4">
            {/* Title */}
            <FormInput
              label="Title *"
              value={form.title}
              onChange={(v) => setForm({ ...form, title: v.slice(0, 100) })}
              placeholder="e.g. Court Maintenance Notice"
              helperText={`${form.title.length}/100`}
            />

            {/* Message */}
            <FormTextarea
              label="Message *"
              value={form.message}
              onChange={(v) => setForm({ ...form, message: v })}
              rows={4}
              placeholder="Write your announcement message..."
              maxLength={500}
            />

            {/* Image Attachment */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Image
                <span className="text-xs font-normal text-slate-400 ml-1">
                  (optional — flyer, promo graphic, etc.)
                </span>
              </label>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > MAX_IMAGE_SIZE) {
                    setSendError("Image must be under 5MB");
                    return;
                  }
                  setSendError("");
                  setImageFile(file);
                  setImagePreview(URL.createObjectURL(file));
                }}
              />
              {imagePreview ? (
                <div className="relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="h-32 rounded-lg object-cover border border-slate-200"
                  />
                  <button
                    onClick={() => {
                      setImageFile(null);
                      setImagePreview(null);
                      if (imageInputRef.current) imageInputRef.current.value = "";
                    }}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-error text-white rounded-full text-xs font-bold flex items-center justify-center hover:bg-red-600 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => imageInputRef.current?.click()}
                  className="px-4 py-2.5 rounded-lg border-2 border-dashed border-slate-300 text-sm text-slate-500 hover:border-brand hover:text-brand transition-colors cursor-pointer"
                >
                  Attach Image
                </button>
              )}
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
                    className="w-4 h-4 text-brand border-slate-300 focus:ring-brand"
                  />
                  <span className="text-sm text-slate-700">All members</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="audience"
                    checked={form.audience === "tier"}
                    onChange={() => setForm({ ...form, audience: "tier" })}
                    className="w-4 h-4 text-brand border-slate-300 focus:ring-brand"
                  />
                  <span className="text-sm text-slate-700">Specific tier</span>
                </label>
                {form.audience === "tier" && (
                  <FormSelect
                    label=""
                    value={form.tier_id}
                    onChange={(v) => setForm({ ...form, tier_id: v })}
                    options={[
                      { value: "", label: "Select a tier..." },
                      ...tiers.map((t) => ({ value: t.id, label: t.name })),
                    ]}
                    className="ml-6 w-64"
                  />
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
                    className="w-4 h-4 text-brand border-slate-300 rounded focus:ring-brand"
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
                    className="w-4 h-4 text-brand border-slate-300 rounded focus:ring-brand"
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
            <div className="bg-error-light border border-red-200 text-error px-4 py-3 rounded-lg mt-4 text-sm">
              {sendError}
            </div>
          )}

          {/* Success */}
          {sendResult && (
            <div className="bg-success-light border border-green-200 text-success px-4 py-3 rounded-lg mt-4 text-sm">
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
            <Button
              onClick={handleSend}
              disabled={!canSend || sending}
              loading={sending}
              size="lg"
            >
              {sending ? "Sending..." : "Send Announcement"}
            </Button>
          </div>
        </Card>

        {/* History */}
        <Card title="Past Announcements" noPadding>
          {historyLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
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
              {history.map((item) => (
                <div key={item.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    {item.image_url && (
                      <img
                        src={item.image_url}
                        alt=""
                        className="w-14 h-14 rounded-lg object-cover shrink-0 mr-3"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-slate-900 truncate">
                        {item.title}
                      </h3>
                      <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">
                        {item.body}
                      </p>
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <p className="text-xs text-slate-400">
                        {formatTimestamp(item.sent_at)}
                      </p>
                      <Badge
                        label={item.audience === "all" ? "All members" : "Specific tier"}
                        variant={item.audience === "all" ? "brand" : "warning"}
                      />
                      {confirmDeleteKey === item.id ? (
                        <div className="flex items-center gap-2 mt-1">
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDeleteAnnouncement(item)}
                            disabled={deletingKey === item.id}
                            loading={deletingKey === item.id}
                          >
                            {deletingKey === item.id ? "Deleting..." : "Confirm"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmDeleteKey(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => setConfirmDeleteKey(item.id)}
                          className="mt-1"
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
