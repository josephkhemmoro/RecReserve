"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { FileText, Upload, ExternalLink, Users, AlertCircle, Trash2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Card, Badge, Button } from "@/components/ui";
import { useConfirm } from "@/components/ui/Dialog";

interface TermsState {
  terms_url: string | null;
  terms_filename: string | null;
  terms_version: number;
  terms_updated_at: string | null;
}

interface TermsConditionsCardProps {
  clubId: string;
}

export function TermsConditionsCard({ clubId }: TermsConditionsCardProps) {
  const [state, setState] = useState<TermsState | null>(null);
  const [acceptedCount, setAcceptedCount] = useState(0);
  const [memberCount, setMemberCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const confirm = useConfirm();

  const fetchState = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: club } = await supabase
      .from("clubs")
      .select("terms_url, terms_filename, terms_version, terms_updated_at")
      .eq("id", clubId)
      .single();

    if (club) {
      setState(club as TermsState);

      if (club.terms_url) {
        const [acceptRes, memRes] = await Promise.all([
          supabase.from("terms_acceptances").select("id", { count: "exact", head: true })
            .eq("club_id", clubId).eq("terms_version", club.terms_version),
          supabase.from("memberships").select("id", { count: "exact", head: true })
            .eq("club_id", clubId).eq("is_active", true),
        ]);
        setAcceptedCount(acceptRes.count || 0);
        setMemberCount(memRes.count || 0);
      }
    }
    setLoading(false);
  }, [clubId]);

  useEffect(() => { fetchState(); }, [fetchState]);

  const handleFile = async (file: File) => {
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Please upload a PDF file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be under 10MB");
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const newVersion = (state?.terms_version || 0) + 1;
      const path = `${clubId}/terms-v${newVersion}-${Date.now()}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("club-terms")
        .upload(path, file, { contentType: "application/pdf", upsert: false });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("club-terms").getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      const { error: updateError } = await supabase
        .from("clubs")
        .update({
          terms_url: publicUrl,
          terms_filename: file.name,
          terms_version: newVersion,
          terms_updated_at: new Date().toISOString(),
        })
        .eq("id", clubId);
      if (updateError) throw updateError;

      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.from("audit_logs").insert({
          club_id: clubId,
          actor_id: session.user.id,
          actor_role: "admin",
          action: state?.terms_url ? "terms.replace" : "terms.upload",
          entity_type: "club",
          entity_id: clubId,
          changes: {
            filename: { old: state?.terms_filename, new: file.name },
            terms_version: { old: state?.terms_version || 0, new: newVersion },
          },
        }).catch(() => {});
      }

      await fetchState();
      toast.success(state?.terms_url ? "Terms replaced — members will be prompted to re-accept" : "Terms uploaded", {
        description: state?.terms_url ? `Now version ${newVersion}` : "Required for future members joining",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    const ok = await confirm({
      title: "Remove terms & conditions?",
      description: "Existing acceptance records are kept for audit. New members won't need to accept anything until you re-upload. Existing members will no longer be prompted.",
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (!ok) return;

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("clubs")
        .update({ terms_url: null, terms_filename: null, terms_updated_at: new Date().toISOString() })
        .eq("id", clubId);
      if (error) throw error;
      await fetchState();
      toast.success("Terms removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove");
    }
  };

  if (loading) {
    return (
      <Card>
        <div className="h-32 animate-shimmer rounded-md" />
      </Card>
    );
  }

  const hasTerms = !!state?.terms_url;
  const acceptanceRate = memberCount > 0 ? Math.round((acceptedCount / memberCount) * 100) : 0;
  const outstandingCount = memberCount - acceptedCount;

  return (
    <Card title="Terms & Conditions" subtitle="Players must accept before joining or booking. Replacing the PDF requires existing members to re-accept.">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={(e) => e.target.files && handleFile(e.target.files[0])}
        className="hidden"
      />

      {!hasTerms ? (
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:border-brand/40 hover:bg-brand-surface/30 transition-colors">
          <div className="h-12 w-12 mx-auto rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-3">
            <FileText className="h-5 w-5 text-slate-400" />
          </div>
          <p className="text-sm font-semibold text-slate-900">No terms uploaded</p>
          <p className="text-xs text-slate-500 mt-1 mb-4 max-w-md mx-auto">
            Upload your club&apos;s terms of service or facility rules. Players will be required to accept before joining.
          </p>
          <Button
            variant="primary"
            icon={<Upload />}
            onClick={() => fileInputRef.current?.click()}
            loading={uploading}
          >
            Upload PDF
          </Button>
          <p className="text-[11px] text-slate-400 mt-2">PDF only · Max 10MB</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="h-10 w-10 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
              <FileText className="h-5 w-5 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-semibold text-slate-900 truncate">{state.terms_filename || "terms.pdf"}</p>
                <Badge label={`v${state.terms_version}`} variant="brand" size="sm" />
              </div>
              <p className="text-xs text-slate-500">
                Updated {state.terms_updated_at ? new Date(state.terms_updated_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—"}
              </p>
            </div>
            <a
              href={state.terms_url || "#"}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-brand hover:text-brand-dark inline-flex items-center gap-1"
            >
              View
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {memberCount > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-100">
                <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Accepted</p>
                <p className="text-xl font-bold text-emerald-900 tabular-nums mt-1">{acceptedCount}</p>
                <p className="text-[11px] text-emerald-700/70 mt-0.5">{acceptanceRate}% of members</p>
              </div>
              <div className={`p-3 rounded-lg ${outstandingCount > 0 ? "bg-amber-50/60 border border-amber-100" : "bg-slate-50 border border-slate-100"}`}>
                <p className={`text-[11px] font-semibold uppercase tracking-wider ${outstandingCount > 0 ? "text-amber-700" : "text-slate-500"}`}>Outstanding</p>
                <p className={`text-xl font-bold tabular-nums mt-1 ${outstandingCount > 0 ? "text-amber-900" : "text-slate-700"}`}>{Math.max(0, outstandingCount)}</p>
                <p className={`text-[11px] mt-0.5 ${outstandingCount > 0 ? "text-amber-700/70" : "text-slate-500"}`}>members not yet accepted</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Active Members</p>
                <p className="text-xl font-bold text-slate-900 tabular-nums mt-1">{memberCount}</p>
                <p className="text-[11px] text-slate-500 mt-0.5 inline-flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  Total
                </p>
              </div>
            </div>
          )}

          {outstandingCount > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50/60 border border-amber-200/60">
              <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-900">
                {outstandingCount} member{outstandingCount > 1 ? "s have" : " has"} not accepted v{state.terms_version} yet.
                They&apos;ll be prompted on next app launch and won&apos;t be able to make new bookings until they accept.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="secondary"
              icon={<Upload />}
              onClick={() => fileInputRef.current?.click()}
              loading={uploading}
            >
              Replace PDF (bumps to v{state.terms_version + 1})
            </Button>
            <Button variant="ghost" icon={<Trash2 />} onClick={handleRemove}>
              Remove
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
