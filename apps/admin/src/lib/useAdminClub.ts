"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

interface AdminInfo {
  userId: string;
  clubId: string;
  clubName: string;
  fullName: string;
}

export function useAdminClub() {
  const [admin, setAdmin] = useState<AdminInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAdmin = async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          setError("No session");
          setLoading(false);
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("users")
          .select("id, club_id, full_name, club:clubs(name)")
          .eq("id", session.user.id)
          .single();

        if (profileError) {
          console.error("useAdminClub profile error:", profileError);
          setError(profileError.message);
          setLoading(false);
          return;
        }

        if (!profile?.club_id) {
          console.warn("Admin user has no club_id assigned");
          setError("No club assigned");
          // Still set admin with what we have so the name renders
          setAdmin({
            userId: profile.id as string,
            clubId: "",
            clubName: "",
            fullName: (profile.full_name as string) || session.user.email || "Admin",
          });
          setLoading(false);
          return;
        }

        const club = profile.club as { name: string } | null;
        setAdmin({
          userId: profile.id as string,
          clubId: profile.club_id as string,
          clubName: club?.name || "",
          fullName: (profile.full_name as string) || session.user.email || "Admin",
        });
      } catch (err) {
        console.error("useAdminClub error:", err);
        setError("Failed to load admin profile");
      } finally {
        setLoading(false);
      }
    };

    fetchAdmin();
  }, []);

  return { admin, loading, error };
}
