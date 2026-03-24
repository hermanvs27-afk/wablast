import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Verify user JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await sb.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    // 2. Check suspension
    const { data: profile } = await sb
      .from("profiles")
      .select("suspended")
      .eq("user_id", user.id)
      .single();

    if (profile?.suspended) {
      return new Response(JSON.stringify({ error: { message: "Account suspended" } }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const metaToken = Deno.env.get("META_ACCESS_TOKEN")!;

    // ── GET — list templates ──────────────────────────────────────
    if (req.method === "GET") {
      const url    = new URL(req.url);
      const wabaId = url.searchParams.get("waba_id");
      if (!wabaId) throw new Error("Missing waba_id");

      const res = await fetch(
        `https://graph.facebook.com/v23.0/${wabaId}/message_templates?fields=id,name,status,category,language,components&limit=50`,
        { headers: { "Authorization": `Bearer ${metaToken}` } }
      );
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ── POST — create template ────────────────────────────────────
    if (req.method === "POST") {
      const { name, category, language, components, waba_id } = await req.json();

      if (!name || !category || !language || !components || !waba_id) {
        throw new Error("Missing required fields");
      }

      const res = await fetch(
        `https://graph.facebook.com/v23.0/${waba_id}/message_templates`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${metaToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name, category, language, components }),
        }
      );

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ── DELETE — delete template ──────────────────────────────────
    if (req.method === "DELETE") {
      const { template_name, waba_id } = await req.json();
      if (!template_name || !waba_id) throw new Error("Missing template_name or waba_id");

      const res = await fetch(
        `https://graph.facebook.com/v23.0/${waba_id}/message_templates?name=${encodeURIComponent(template_name)}`,
        {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${metaToken}` },
        }
      );

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({ error: { message: err.message } }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
