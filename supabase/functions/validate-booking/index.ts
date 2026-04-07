import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ valid: false, errors: [{ code: "AUTH", message: "Missing authorization header" }] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = getServiceClient();
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ valid: false, errors: [{ code: "AUTH", message: "Unauthorized: " + (authError?.message || "invalid token") }] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { court_id, club_id, start_time, end_time, guest_count } = body;

    if (!court_id || !club_id || !start_time || !end_time) {
      return new Response(
        JSON.stringify({ valid: false, errors: [{ code: "MISSING_FIELDS", message: "Missing required fields: court_id, club_id, start_time, end_time" }] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call the server-side validation function
    const { data, error } = await supabase.rpc("validate_booking", {
      p_user_id: user.id,
      p_club_id: club_id,
      p_court_id: court_id,
      p_start_time: start_time,
      p_end_time: end_time,
      p_guest_count: guest_count || 0,
    });

    if (error) {
      console.error("Validation RPC error:", JSON.stringify(error));
      // Return the actual RPC error as a validation failure, not a 500
      return new Response(
        JSON.stringify({
          valid: false,
          errors: [{ code: "RPC_ERROR", message: error.message || "Database validation failed" }],
          debug: { hint: error.hint, details: error.details, code: error.code },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the result
    const result = typeof data === "string" ? JSON.parse(data) : data;

    if (!result || result.valid === undefined) {
      return new Response(
        JSON.stringify({
          valid: false,
          errors: [{ code: "INVALID_RESPONSE", message: "Unexpected validation response" }],
          debug: { raw: JSON.stringify(data) },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!result.valid) {
      return new Response(
        JSON.stringify({
          valid: false,
          errors: (result.errors || []).map((e: string) => {
            const colonIdx = e.indexOf(": ");
            if (colonIdx > 0) {
              return {
                code: e.substring(0, colonIdx),
                message: e.substring(colonIdx + 2),
              };
            }
            return { code: "UNKNOWN", message: e };
          }),
          warnings: result.warnings || [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate a validation token
    const validationToken = crypto.randomUUID();

    return new Response(
      JSON.stringify({
        valid: true,
        validation_token: validationToken,
        errors: [],
        warnings: result.warnings || [],
        membership_id: result.membership_id,
        tier_id: result.tier_id,
        discount_percent: result.discount_percent || 0,
        can_book_free: result.can_book_free || false,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error in validate-booking:", err);
    // Always return 200 with error details so the client can show them
    return new Response(
      JSON.stringify({
        valid: false,
        errors: [{ code: "INTERNAL", message: err.message ?? "Internal server error" }],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
