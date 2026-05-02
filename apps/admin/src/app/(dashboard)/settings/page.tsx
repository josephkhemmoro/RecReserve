"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAdminClub } from "@/lib/useAdminClub";
import { ClubPhotoManager } from "@/components/settings/ClubPhotoManager";
import { MembershipRequirementsCard } from "@/components/settings/MembershipRequirementsCard";
import { TermsConditionsCard } from "@/components/settings/TermsConditionsCard";

interface ClubData {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  phone: string | null;
  website: string | null;
  logo_url: string | null;
}

interface FormState {
  name: string;
  description: string;
  location: string;
  phone: string;
  website: string;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

async function compressImage(file: File, maxBytes: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const MAX_DIM = 1024;
      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      let quality = 0.9;
      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Compression failed"));
              return;
            }
            if (blob.size <= maxBytes || quality <= 0.1) {
              resolve(blob);
            } else {
              quality -= 0.1;
              tryCompress();
            }
          },
          "image/jpeg",
          quality
        );
      };
      tryCompress();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

export default function SettingsPage() {
  const { admin, loading: adminLoading } = useAdminClub();
  const [club, setClub] = useState<ClubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  const [form, setForm] = useState<FormState>({
    name: "",
    description: "",
    location: "",
    phone: "",
    website: "",
  });
  const [original, setOriginal] = useState<FormState>({
    name: "",
    description: "",
    location: "",
    phone: "",
    website: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const fetchClub = useCallback(async (clubId: string) => {
    setLoading(true);
    setFetchError("");
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("clubs")
        .select("id, name, description, location, phone, website, logo_url")
        .eq("id", clubId)
        .single();

      if (error) throw error;

      const clubData: ClubData = {
        id: data.id as string,
        name: data.name as string,
        description: (data.description as string) ?? null,
        location: (data.location as string) ?? null,
        phone: (data.phone as string) ?? null,
        website: (data.website as string) ?? null,
        logo_url: (data.logo_url as string) ?? null,
      };
      setClub(clubData);

      const formData: FormState = {
        name: clubData.name,
        description: clubData.description ?? "",
        location: clubData.location ?? "",
        phone: clubData.phone ?? "",
        website: clubData.website ?? "",
      };
      setForm(formData);
      setOriginal(formData);
    } catch (err) {
      console.error("Error fetching club:", err);
      setFetchError(err instanceof Error ? err.message : "Failed to load club settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (admin?.clubId) fetchClub(admin.clubId);
  }, [admin?.clubId, fetchClub]);

  const isDirty =
    form.name !== original.name ||
    form.description !== original.description ||
    form.location !== original.location ||
    form.phone !== original.phone ||
    form.website !== original.website;

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) {
      errors.name = "Club name is required";
    }
    if (form.description.length > 500) {
      errors.description = "Description must be 500 characters or less";
    }
    if (form.phone && !/^[+\d\s().-]{7,20}$/.test(form.phone)) {
      errors.phone = "Enter a valid phone number";
    }
    if (form.website && !/^https?:\/\//.test(form.website)) {
      errors.website = "URL must start with http:// or https://";
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!admin?.clubId || !isDirty) return;
    if (!validate()) return;

    setSaving(true);
    setSaveError("");
    setSaved(false);

    try {
      const supabase = createClient();
      const { data: updated, error } = await supabase
        .from("clubs")
        .update({
          name: form.name.trim(),
          description: form.description.trim() || null,
          location: form.location.trim() || null,
          phone: form.phone.trim() || null,
          website: form.website.trim() || null,
        })
        .eq("id", admin.clubId)
        .select()
        .single();

      if (error) throw error;
      if (!updated) throw new Error("Update failed — check RLS policies on the clubs table");

      const newOriginal: FormState = {
        name: form.name.trim(),
        description: form.description.trim(),
        location: form.location.trim(),
        phone: form.phone.trim(),
        website: form.website.trim(),
      };
      setOriginal(newOriginal);
      setForm(newOriginal);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error("Error saving club:", err);
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !admin?.clubId || !club) return;

    setUploading(true);
    setUploadError("");

    try {
      const compressed = await compressImage(file, 1024 * 1024);
      const supabase = createClient();
      const path = `${admin.clubId}/logo`;

      const { error: uploadErr } = await supabase.storage
        .from("club-assets")
        .upload(path, compressed, {
          cacheControl: "3600",
          upsert: true,
          contentType: "image/jpeg",
        });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from("club-assets")
        .getPublicUrl(path);

      const publicUrl = `${urlData.publicUrl}?v=${Date.now()}`;

      const { error: updateErr } = await supabase
        .from("clubs")
        .update({ logo_url: publicUrl })
        .eq("id", admin.clubId);

      if (updateErr) throw updateErr;

      setClub({ ...club, logo_url: publicUrl });
    } catch (err) {
      console.error("Error uploading logo:", err);
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (adminLoading || loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-8">Settings</h1>
        <div className="max-w-2xl space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 animate-pulse">
            <div className="flex items-center gap-6 mb-6">
              <div className="w-24 h-24 rounded-2xl bg-slate-200" />
              <div className="space-y-2">
                <div className="h-5 w-40 bg-slate-200 rounded" />
                <div className="h-4 w-28 bg-slate-200 rounded" />
              </div>
            </div>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 bg-slate-100 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-8">Settings</h1>
        <div className="max-w-2xl bg-white rounded-xl border border-slate-200 p-10 text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-1">Failed to load settings</h3>
          <p className="text-sm text-slate-500 mb-6">{fetchError}</p>
          <button
            onClick={() => admin?.clubId && fetchClub(admin.clubId)}
            className="px-5 py-2.5 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your club&apos;s identity and profile
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Logo Section */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Club Logo</h2>
          <div className="flex items-center gap-6">
            <div className="relative">
              {club?.logo_url ? (
                <img
                  src={club.logo_url}
                  alt={club.name}
                  className="w-24 h-24 rounded-2xl object-cover border border-slate-200"
                />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center">
                  <span className="text-2xl font-bold text-slate-400">
                    {getInitials(club?.name ?? "C")}
                  </span>
                </div>
              )}
              {uploading && (
                <div className="absolute inset-0 rounded-2xl bg-white/80 flex items-center justify-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-brand" />
                </div>
              )}
            </div>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="px-4 py-2 text-sm font-medium text-slate-700 rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                {uploading ? "Uploading..." : "Change Photo"}
              </button>
              <p className="text-xs text-slate-400 mt-1.5">
                JPG, PNG or GIF. Max 1 MB after compression.
              </p>
              {uploadError && (
                <p className="text-xs text-error mt-1">{uploadError}</p>
              )}
            </div>
          </div>
        </div>

        {/* Club Details Form */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Club Details</h2>

          <div className="space-y-4">
            {/* Club Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Club Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => {
                  setForm({ ...form, name: e.target.value });
                  setValidationErrors((v) => ({ ...v, name: "" }));
                }}
                className={`w-full px-4 py-2.5 rounded-lg border text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand ${
                  validationErrors.name ? "border-red-300" : "border-slate-300"
                }`}
              />
              {validationErrors.name && (
                <p className="text-xs text-error mt-1">{validationErrors.name}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => {
                  setForm({ ...form, description: e.target.value });
                  setValidationErrors((v) => ({ ...v, description: "" }));
                }}
                rows={3}
                maxLength={500}
                className={`w-full px-4 py-2.5 rounded-lg border text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand ${
                  validationErrors.description ? "border-red-300" : "border-slate-300"
                }`}
                placeholder="A brief description of your club"
              />
              <div className="flex justify-between mt-1">
                {validationErrors.description ? (
                  <p className="text-xs text-error">{validationErrors.description}</p>
                ) : (
                  <span />
                )}
                <span className={`text-xs ${form.description.length > 480 ? "text-amber-600" : "text-slate-400"}`}>
                  {form.description.length}/500
                </span>
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Location / Address
              </label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
                placeholder="123 Main St, City, State"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => {
                  setForm({ ...form, phone: e.target.value });
                  setValidationErrors((v) => ({ ...v, phone: "" }));
                }}
                className={`w-full px-4 py-2.5 rounded-lg border text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand ${
                  validationErrors.phone ? "border-red-300" : "border-slate-300"
                }`}
                placeholder="(555) 123-4567"
              />
              {validationErrors.phone && (
                <p className="text-xs text-error mt-1">{validationErrors.phone}</p>
              )}
            </div>

            {/* Website */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Website
              </label>
              <input
                type="text"
                value={form.website}
                onChange={(e) => {
                  setForm({ ...form, website: e.target.value });
                  setValidationErrors((v) => ({ ...v, website: "" }));
                }}
                className={`w-full px-4 py-2.5 rounded-lg border text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand ${
                  validationErrors.website ? "border-red-300" : "border-slate-300"
                }`}
                placeholder="https://www.yourclub.com"
              />
              {validationErrors.website && (
                <p className="text-xs text-error mt-1">{validationErrors.website}</p>
              )}
            </div>
          </div>

          {/* Save */}
          <div className="flex items-center gap-3 mt-6">
            <button
              onClick={handleSave}
              disabled={!isDirty || saving}
              className="px-5 py-2.5 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {saving && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              )}
              {saving ? "Saving..." : "Save Changes"}
            </button>
            {saved && (
              <span className="flex items-center gap-1 text-sm font-medium text-success">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Saved
              </span>
            )}
            {saveError && (
              <span className="text-sm text-error">{saveError}</span>
            )}
          </div>
        </div>

        {/* Membership Requirements */}
        {admin?.clubId && <MembershipRequirementsCard clubId={admin.clubId} />}

        {/* Terms & Conditions */}
        {admin?.clubId && <TermsConditionsCard clubId={admin.clubId} />}

        {/* Club Photos */}
        {admin?.clubId && <ClubPhotoManager clubId={admin.clubId} />}

        {/* Danger Zone */}
        <div className="bg-white rounded-xl border-2 border-red-200 p-6">
          <h2 className="text-lg font-semibold text-red-700 mb-1">Danger Zone</h2>
          <p className="text-sm text-slate-500 mb-4">
            Irreversible actions for your club
          </p>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-slate-900">Transfer Ownership</p>
              <p className="text-xs text-slate-500">Transfer this club to another admin</p>
            </div>
            <div className="relative group">
              <button
                disabled
                className="px-4 py-2 text-sm font-medium text-error rounded-lg border border-red-200 opacity-50 cursor-not-allowed"
              >
                Transfer
              </button>
              <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-slate-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                Coming soon
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
