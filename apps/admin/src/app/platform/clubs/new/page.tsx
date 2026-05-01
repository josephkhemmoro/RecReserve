"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2, Building2, UserPlus, Sparkles, ArrowRight } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Card, PageHeader, Button, FormInput } from "@/components/ui";

interface CreateResult {
  clubId: string;
  clubName: string;
  inviteEmail: string;
  inviteName: string;
}

export default function CreateClubPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [requirePaid, setRequirePaid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<CreateResult | null>(null);
  const [existingUserPromoted, setExistingUserPromoted] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = name.trim().length >= 2 && adminEmail.includes("@") && adminName.trim().length >= 2;

  const handleCreate = async () => {
    setError("");
    setSaving(true);
    try {
      const supabase = createClient();

      const { data: club, error: clubError } = await supabase
        .from("clubs")
        .insert({
          name: name.trim(),
          location: location.trim() || null,
          phone: phone.trim() || null,
          website: website.trim() || null,
          requires_paid_membership: requirePaid,
          platform_status: "active",
        })
        .select("id, name")
        .single();

      if (clubError) throw clubError;

      // If the admin already has a Supabase Auth account, promote them now.
      // Otherwise, the platform admin will need to come back after the user signs up
      // and click "Promote to Admin" on the club detail page.
      const normalizedEmail = adminEmail.trim().toLowerCase();
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("email", normalizedEmail)
        .maybeSingle();

      let didPromote = false;
      if (existingUser) {
        const { error: promoteError } = await supabase
          .from("users")
          .update({ club_id: club.id, role: "admin", full_name: adminName.trim() })
          .eq("id", existingUser.id);
        if (!promoteError) didPromote = true;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.from("audit_logs").insert({
          club_id: club.id,
          actor_id: session.user.id,
          action: "club.create",
          entity_type: "club",
          entity_id: club.id,
          changes: {
            name: { new: club.name },
            admin_email: { new: normalizedEmail },
            admin_promoted_now: { new: didPromote },
          },
        }).catch(() => {});
      }

      setExistingUserPromoted(didPromote);
      setResult({
        clubId: club.id,
        clubName: club.name,
        inviteEmail: normalizedEmail,
        inviteName: adminName.trim(),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create club");
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    const loginUrl = typeof window !== "undefined" ? `${window.location.origin}/login` : "/login";
    return (
      <div className="max-w-2xl mx-auto">
        <PageHeader eyebrow="Platform" title="Club Created" subtitle={`${result.clubName} is live and ready for ${result.inviteName}.`} />

        <Card>
          <div className="space-y-5">
            <div className="relative overflow-hidden p-5 rounded-xl bg-gradient-to-br from-emerald-50 via-emerald-50/60 to-white border border-emerald-200/70">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center ring-1 ring-emerald-200">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-emerald-900">{result.clubName} is live</p>
                  <p className="text-xs text-emerald-800/80 mt-1 leading-relaxed">
                    Status: active · Platform fee: 5% · Stripe Connect: not yet onboarded
                    {existingUserPromoted && <> · {result.inviteEmail} promoted to admin</>}
                  </p>
                </div>
              </div>
            </div>

            {existingUserPromoted ? (
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-brand" />
                  Send this to {result.inviteName}
                </h3>
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 whitespace-pre-line font-mono leading-relaxed">
{`Hi ${result.inviteName},

Your RecReserve admin account is ready. Sign in at ${loginUrl} with ${result.inviteEmail} and your existing password — you'll land directly on your club's admin dashboard.

First thing to do: click the Stripe banner at the top to connect your bank for payouts.

Let me know if you hit any issues.`}
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-amber-600" />
                  Two-step handoff
                </h3>
                <p className="text-xs text-slate-500 mb-3">{result.inviteEmail} doesn&apos;t have an account yet, so we couldn&apos;t auto-promote.</p>
                <div className="p-4 rounded-lg bg-amber-50/60 border border-amber-200/60 text-sm space-y-3">
                  <div>
                    <p className="text-xs font-bold text-amber-900 mb-2 uppercase tracking-wider">Step 1 — Send this invite</p>
                    <div className="p-3 rounded-md bg-white border border-amber-100 whitespace-pre-line text-slate-700 text-xs font-mono leading-relaxed">
{`Hi ${result.inviteName},

Sign up at ${loginUrl} using ${result.inviteEmail}. Once you've created your account, let me know and I'll finalize your admin access.`}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-amber-200/40">
                    <p className="text-xs font-bold text-amber-900 mb-1 uppercase tracking-wider">Step 2 — After they sign up</p>
                    <p className="text-xs text-amber-900 leading-relaxed">
                      Come back to <Link href={`/platform/clubs/${result.clubId}`} className="underline font-semibold">this club&apos;s detail page</Link> and click &quot;Promote to Admin&quot;.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2">
              <Link href={`/platform/clubs/${result.clubId}`}>
                <Button variant="primary" icon={<ArrowRight />}>View Club</Button>
              </Link>
              <Link href="/platform/clubs">
                <Button variant="secondary">Back to Clubs</Button>
              </Link>
              <Button
                variant="ghost"
                onClick={() => {
                  setResult(null); setExistingUserPromoted(false);
                  setName(""); setLocation(""); setPhone(""); setWebsite("");
                  setAdminName(""); setAdminEmail(""); setRequirePaid(false);
                }}
              >
                Create Another
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader eyebrow="Platform" title="Create New Club" subtitle="Onboard a new pilot club to RecReserve in under 60 seconds." />

      <Card>
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-4 w-4 text-brand" />
              <h3 className="text-sm font-bold text-slate-900">Club Info</h3>
            </div>
            <div className="space-y-3">
              <FormInput label="Club name *" value={name} onChange={setName} placeholder="e.g. Westside Tennis & Pickleball" />
              <FormInput label="Location" value={location} onChange={setLocation} placeholder="City, State" />
              <div className="grid grid-cols-2 gap-3">
                <FormInput label="Phone" value={phone} onChange={setPhone} placeholder="(555) 555-5555" />
                <FormInput label="Website" value={website} onChange={setWebsite} placeholder="https://..." />
              </div>
            </div>
          </div>

          <div className="pt-5 border-t border-slate-100">
            <div className="flex items-center gap-2 mb-3">
              <UserPlus className="h-4 w-4 text-brand" />
              <h3 className="text-sm font-bold text-slate-900">Initial Admin</h3>
            </div>
            <p className="text-xs text-slate-500 mb-3 leading-relaxed">
              If they already have an account, we&apos;ll promote them now. If not, they sign up first, then you click &quot;Promote to Admin&quot; on the club detail page.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <FormInput label="Admin name *" value={adminName} onChange={setAdminName} placeholder="Jane Doe" />
              <FormInput label="Admin email *" value={adminEmail} onChange={setAdminEmail} placeholder="jane@club.com" />
            </div>
          </div>

          <div className="pt-5 border-t border-slate-100">
            <label className="flex items-start gap-3 cursor-pointer p-3 -m-3 rounded-lg hover:bg-slate-50 transition-colors">
              <input
                type="checkbox"
                checked={requirePaid}
                onChange={(e) => setRequirePaid(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand cursor-pointer"
              />
              <div>
                <p className="text-sm font-semibold text-slate-900">Require paid membership to join</p>
                <p className="text-xs text-slate-500 mt-0.5">Players must subscribe to a paid tier to book courts. You can toggle this later in club settings.</p>
              </div>
            </label>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 animate-fade-in-up">
              <span className="font-semibold">Couldn&apos;t create club: </span>{error}
            </div>
          )}

          <div className="flex gap-3 pt-5 border-t border-slate-100">
            <Button variant="primary" onClick={handleCreate} disabled={!canSubmit} loading={saving}>
              {saving ? "Creating…" : "Create Club"}
            </Button>
            <Button variant="secondary" onClick={() => router.push("/platform/clubs")} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
