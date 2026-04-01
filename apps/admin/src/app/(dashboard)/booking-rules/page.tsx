"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { useAdminClub } from "@/lib/useAdminClub";
import { PageHeader, Card, FormInput, Button, Skeleton } from "@/components/ui";

interface RulesForm {
  id: string | null;
  max_booking_duration_mins: number;
  advance_booking_days: number;
  cancellation_cutoff_hours: number;
  max_active_bookings_per_user: number;
}

const DEFAULT_RULES: RulesForm = {
  id: null,
  max_booking_duration_mins: 60,
  advance_booking_days: 7,
  cancellation_cutoff_hours: 2,
  max_active_bookings_per_user: 2,
};

export default function BookingRulesPage() {
  const { admin, loading: adminLoading } = useAdminClub();
  const [form, setForm] = useState<RulesForm>(DEFAULT_RULES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!admin?.clubId) return;

    const fetchRules = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("booking_rules")
          .select("*")
          .eq("club_id", admin.clubId)
          .single();

        if (error && error.code !== "PGRST116") throw error;

        if (data) {
          setForm({
            id: data.id as string,
            max_booking_duration_mins: data.max_booking_duration_mins as number,
            advance_booking_days: data.advance_booking_days as number,
            cancellation_cutoff_hours: data.cancellation_cutoff_hours as number,
            max_active_bookings_per_user: data.max_active_bookings_per_user as number,
          });
        }
      } catch (err) {
        console.error("Error fetching rules:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRules();
  }, [admin?.clubId]);

  const handleSave = async () => {
    if (!admin?.clubId) return;
    setSaving(true);
    setToast("");

    try {
      const supabase = createClient();
      const payload = {
        club_id: admin.clubId,
        max_booking_duration_mins: form.max_booking_duration_mins,
        advance_booking_days: form.advance_booking_days,
        cancellation_cutoff_hours: form.cancellation_cutoff_hours,
        max_active_bookings_per_user: form.max_active_bookings_per_user,
      };

      if (form.id) {
        const { error } = await supabase
          .from("booking_rules")
          .update(payload)
          .eq("id", form.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("booking_rules")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        setForm((prev) => ({ ...prev, id: data.id as string }));
      }

      setToast("Booking rules saved successfully");
      setTimeout(() => setToast(""), 3000);
    } catch (err) {
      console.error("Error saving rules:", err);
      setToast("Error saving rules");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof RulesForm, value: number) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  if (adminLoading || loading) {
    return (
      <div>
        <PageHeader title="Booking Rules" />
        <Card>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Booking Rules" />

      {toast && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
            toast.includes("Error")
              ? "bg-error-light text-error"
              : "bg-success-light text-success"
          }`}
        >
          {toast}
        </div>
      )}

      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <FormInput
            label="Max Booking Duration (minutes)"
            type="number"
            min={15}
            step={15}
            value={form.max_booking_duration_mins}
            onChange={(v) => updateField("max_booking_duration_mins", Number(v))}
          />

          <FormInput
            label="Advance Booking Window (days)"
            type="number"
            min={1}
            value={form.advance_booking_days}
            onChange={(v) => updateField("advance_booking_days", Number(v))}
          />

          <FormInput
            label="Cancellation Cutoff (hours)"
            type="number"
            min={0}
            value={form.cancellation_cutoff_hours}
            onChange={(v) => updateField("cancellation_cutoff_hours", Number(v))}
          />

          <FormInput
            label="Max Active Bookings Per User"
            type="number"
            min={1}
            value={form.max_active_bookings_per_user}
            onChange={(v) => updateField("max_active_bookings_per_user", Number(v))}
          />
        </div>

        <div className="mt-6">
          <Button
            onClick={handleSave}
            loading={saving}
            size="lg"
          >
            {saving ? "Saving..." : "Save Rules"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
