import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, html, useCustomSmtp } = await req.json();

    if (!to || !html) {
      return new Response(
        JSON.stringify({ success: false, message: "Campos 'to' e 'html' são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client to read platform_settings
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Optionally verify auth (for non-system calls)
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const supabaseUser = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
      if (authError || !user) {
        return new Response(
          JSON.stringify({ success: false, message: "Não autorizado" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Load SMTP config from platform_settings
    const { data: smtpSetting } = await supabaseAdmin
      .from("platform_settings")
      .select("value")
      .eq("key", "smtp_config")
      .maybeSingle();

    const smtpConfig = smtpSetting?.value as Record<string, any> | null;

    if (!smtpConfig?.enabled && useCustomSmtp !== false) {
      // Fall back: just return info that custom SMTP is not enabled
      return new Response(
        JSON.stringify({
          success: false,
          message: "SMTP personalizado não está ativado. Configure nas configurações de e-mail.",
          fallback: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!smtpConfig?.host || !smtpConfig?.port) {
      return new Response(
        JSON.stringify({ success: false, message: "Configuração SMTP incompleta. Verifique host e porta." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load email template
    const { data: templateSetting } = await supabaseAdmin
      .from("platform_settings")
      .select("value")
      .eq("key", "recovery_email_template")
      .maybeSingle();

    const template = templateSetting?.value as Record<string, any> | null;

    const portNum = parseInt(smtpConfig.port, 10);
    const useTls = smtpConfig.encryption === "tls" || smtpConfig.encryption === "ssl";

    const client = new SMTPClient({
      connection: {
        hostname: smtpConfig.host,
        port: portNum,
        tls: useTls,
        auth: smtpConfig.user && smtpConfig.password
          ? { username: smtpConfig.user, password: smtpConfig.password }
          : undefined,
      },
    });

    const finalSubject = subject || template?.subject || "Recuperação de Senha";

    await client.send({
      from: `${smtpConfig.from_name || "Sistema"} <${smtpConfig.from_email || smtpConfig.user}>`,
      to,
      subject: finalSubject,
      content: "Por favor, visualize este e-mail em um cliente que suporte HTML.",
      html,
    });

    await client.close();

    return new Response(
      JSON.stringify({ success: true, message: `E-mail enviado com sucesso para ${to}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, message: `Erro ao enviar e-mail: ${err.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
