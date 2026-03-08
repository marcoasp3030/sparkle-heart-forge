import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is admin or superadmin
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check caller role
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("role, company_id")
      .eq("user_id", caller.id)
      .single();

    const callerRole = callerProfile?.role;
    if (callerRole !== "superadmin" && callerRole !== "admin") {
      return new Response(JSON.stringify({ error: "Acesso restrito a administradores" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { person_id, email, password } = await req.json();

    if (!person_id || !email || !password) {
      return new Response(JSON.stringify({ error: "ID da pessoa, e-mail e senha são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: "A senha deve ter pelo menos 6 caracteres" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get person record
    const { data: person, error: personError } = await adminClient
      .from("funcionarios_clientes")
      .select("id, nome, company_id, user_id")
      .eq("id", person_id)
      .single();

    if (personError || !person) {
      return new Response(JSON.stringify({ error: "Pessoa não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin can only create for their own company
    if (callerRole === "admin" && callerProfile.company_id !== person.company_id) {
      return new Response(JSON.stringify({ error: "Você não pode criar acesso para pessoas de outra empresa" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (person.user_id) {
      return new Response(JSON.stringify({ error: "Esta pessoa já possui acesso ao sistema" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create auth user
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: person.nome },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update profile with company_id and role 'user'
    await adminClient
      .from("profiles")
      .update({ company_id: person.company_id, role: "user", full_name: person.nome })
      .eq("user_id", newUser.user.id);

    // Link person record to auth user
    await adminClient
      .from("funcionarios_clientes")
      .update({ user_id: newUser.user.id, email })
      .eq("id", person_id);

    return new Response(
      JSON.stringify({
        success: true,
        user_id: newUser.user.id,
        message: `Acesso criado para ${person.nome}`,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
