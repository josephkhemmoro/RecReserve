import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { sendExpoPush } from "../_shared/push.ts";

serve(async (req) => {
  try {
    const { reservation_id } = await req.json();

    if (!reservation_id) {
      return new Response(JSON.stringify({ error: "reservation_id required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = getServiceClient();

    // Fetch reservation with court and user details
    const { data: reservation, error: resError } = await supabase
      .from("reservations")
      .select("id, user_id, club_id, start_time, end_time, court:courts(name)")
      .eq("id", reservation_id)
      .single();

    if (resError || !reservation) {
      return new Response(JSON.stringify({ error: "Reservation not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get user's push token
    const { data: user } = await supabase
      .from("users")
      .select("push_token, full_name")
      .eq("id", reservation.user_id)
      .single();

    const startDate = new Date(reservation.start_time);
    const dateStr = startDate.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const timeStr = startDate.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

    // Fetch club name
    const { data: club } = await supabase
      .from("clubs")
      .select("name")
      .eq("id", reservation.club_id)
      .single();
    const clubName = club?.name ?? "";

    const courtName = reservation.court?.name ?? "Court";
    const title = clubName ? `${clubName} - Booking Confirmed` : "Booking Confirmed";
    const body = `${courtName} on ${dateStr} at ${timeStr}`;

    // Write to notifications table
    await supabase.from("notifications").insert({
      user_id: reservation.user_id,
      title,
      body,
      type: "booking_confirmation",
      read: false,
    });

    // Send push notification if token exists
    if (user?.push_token) {
      await sendExpoPush({
        to: user.push_token,
        title,
        body,
        data: {
          type: "booking_confirmation",
          reservation_id,
        },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
