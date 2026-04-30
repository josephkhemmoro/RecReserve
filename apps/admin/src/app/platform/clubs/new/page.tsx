"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
        <PageHeader title="Club Created" subtitle={result.clubName} />

        <Card>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
              <p className="text-sm font-semibold text-emerald-900">✓ {result.clubName} is live</p>
              <p className="text-xs text-emerald-800 mt-1">
                Status: active · Platform fee: 5% · Stripe Connect: not yet onboarded
                {existingUserPromoted && <> · {result.inviteEmail} promoted to admin</>}
              </p>
            </div>

            {existingUserPromoted ? (
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Send this to {result.inviteName}:</h3>
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 whitespace-pre-line">
{`Hi ${result.inviteName},

Your RecReserve admin account is ready. Sign in at ${loginUrl} with ${result.inviteEmail} and your existing password — you'll land directly on your club's admin dashboard.

First thing to do: click the Stripe banner at the top to connect your bank for payouts.

Let me know if you hit any issues.`}
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-sm font-semibold text-slate-900 mb-2">Two-step handoff (since {result.inviteEmail} doesn&apos;t have an account yet):</h3>
                <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900 space-y-2">
                  <p><strong>Step 1.</strong> Send this signup invite to {result.inviteName}:</p>
                  <div className="p-3 rounded bg-white border border-amber-100 whitespace-pre-line text-slate-700 text-xs">
{`Hi ${result.inviteName},

Sign up at ${loginUrl} using ${result.inviteEmail}. Once you've created your account, let me know and I'll finalize your admin access.`}
                  </div>
                  <p className="pt-2"><strong>Step 2.</strong> After they sign up, come back to <Link href={`/platform/clubs/${result.clubId}`} className="underline font-semibold">this club&apos;s detail page</Link> and click &quot;Promote to Admin&quot; with their email.</p>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Link href={`/platform/clubs/${result.clubId}`}>
                <Button variant="primary">View Club</Button>
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
      <PageHeader title="Create New Club" subtitle="Onboard a new pilot club to RecReserve" />

      <Card>
        <div className="space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Club Info</h3>
            <div className="space-y-3">
              <FormInput label="Club name *" value={name} onChange={setName} placeholder="e.g. Westside Tennis & Pickleball" />
              <FormInput label="Location" value={location} onChange={setLocation} placeholder="City, State" />
              <FormInput label="Phone" value={phone} onChange={setPhone} placeholder="(555) 555-5555" />
              <FormInput label="Website" value={website} onChange={setWebsite} placeholder="https://..." />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Initial Admin</h3>
            <p className="text-xs text-slate-500 mb-3">
              If they already have an account, we&apos;ll promote them now. If not, they sign up first, then you click &quot;Promote to Admin&quot; on the club detail page.
            </p>
            <div className="space-y-3">
              <FormInput label="Admin name *" value={adminName} onChange={setAdminName} placeholder="Jane Doe" />
              <FormInput label="Admin email *" value={adminEmail} onChange={setAdminEmail} placeholder="jane@club.com" />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={requirePaid} onChange={(e) => setRequirePaid(e.target.checked)} className="mt-1" />
              <div>
                <p className="text-sm font-semibold text-slate-900">Require paid membership to join</p>
                <p className="text-xs text-slate-500">Players must subscribe to a paid tier to book courts. You can toggle this later in club settings.</p>
              </div>
            </label>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
          )}

          <div className="flex gap-3 pt-3 border-t border-slate-100">
            <Button variant="primary" onClick={handleCreate} disabled={!canSubmit || saving}>
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
