"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/utils/supabase/client";

interface ClubPhoto {
  id: string;
  photo_url: string;
  caption: string | null;
  sort_order: number;
}

interface Props {
  clubId: string;
}

export function ClubPhotoManager({ clubId }: Props) {
  const [photos, setPhotos] = useState<ClubPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchPhotos = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("club_photos")
        .select("id, photo_url, caption, sort_order")
        .eq("club_id", clubId)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      setPhotos((data ?? []) as ClubPhoto[]);
    } catch (err) {
      console.error("Error fetching photos:", err);
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("Photo must be under 5MB");
      return;
    }

    if (photos.length >= 20) {
      setError("Maximum 20 photos per club");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const filePath = `${clubId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("club-assets")
        .upload(filePath, file, { upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("club-assets")
        .getPublicUrl(filePath);

      const { error: insertError } = await supabase
        .from("club_photos")
        .insert({
          club_id: clubId,
          photo_url: urlData.publicUrl,
          sort_order: photos.length,
        });

      if (insertError) throw insertError;

      fetchPhotos();
    } catch (err) {
      console.error("Error uploading photo:", err);
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDelete = async (photo: ClubPhoto) => {
    if (!confirm("Delete this photo?")) return;
    setDeletingId(photo.id);

    try {
      const supabase = createClient();

      // Extract storage path from URL
      const urlParts = photo.photo_url.split("/club-assets/");
      if (urlParts[1]) {
        await supabase.storage
          .from("club-assets")
          .remove([decodeURIComponent(urlParts[1])]);
      }

      const { error } = await supabase
        .from("club_photos")
        .delete()
        .eq("id", photo.id);

      if (error) throw error;
      fetchPhotos();
    } catch (err) {
      console.error("Error deleting photo:", err);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8 animate-pulse">
        <div className="h-5 w-32 bg-slate-200 rounded mb-4" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-slate-100 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Club Photos</h2>
          <p className="text-sm text-slate-500">
            {photos.length}/20 photos · Visible to all players browsing your club
          </p>
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading || photos.length >= 20}
            className="px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark disabled:opacity-50 transition-colors"
          >
            {uploading ? "Uploading..." : "Add Photo"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {photos.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">
          No photos yet. Add photos to showcase your club.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map((photo) => (
            <div key={photo.id} className="relative group">
              <img
                src={photo.photo_url}
                alt={photo.caption || "Club photo"}
                className="w-full h-32 object-cover rounded-lg"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors rounded-lg flex items-center justify-center">
                <button
                  onClick={() => handleDelete(photo)}
                  disabled={deletingId === photo.id}
                  className="opacity-0 group-hover:opacity-100 transition-opacity px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg"
                >
                  {deletingId === photo.id ? "..." : "Delete"}
                </button>
              </div>
              {photo.caption && (
                <p className="text-xs text-slate-500 mt-1 truncate">
                  {photo.caption}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
