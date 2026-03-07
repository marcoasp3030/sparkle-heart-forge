import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

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
    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, message: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, message: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roleData } = await supabase.rpc("get_user_role", { _user_id: user.id });
    if (roleData !== "admin" && roleData !== "superadmin") {
      return new Response(JSON.stringify({ success: false, message: "Sem permissão" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { host, port, user: smtpUser, password, encryption } = await req.json();

    if (!host || !port) {
      return new Response(JSON.stringify({ success: false, message: "Host e porta são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Test TCP connection to SMTP server
    const portNum = parseInt(port, 10);
    const usesTls = encryption === "ssl" || (encryption === "tls" && portNum === 465);

    try {
      let conn: Deno.TcpConn | Deno.TlsConn;

      if (usesTls) {
        conn = await Deno.connectTls({ hostname: host, port: portNum });
      } else {
        conn = await Deno.connect({ hostname: host, port: portNum });
      }

      // Read server greeting
      const buf = new Uint8Array(1024);
      const n = await conn.read(buf);
      const greeting = new TextDecoder().decode(buf.subarray(0, n ?? 0));

      // Send EHLO
      const ehlo = new TextEncoder().encode("EHLO test\r\n");
      await conn.write(ehlo);
      const ehloResp = new Uint8Array(2048);
      const en = await conn.read(ehloResp);
      const ehloText = new TextDecoder().decode(ehloResp.subarray(0, en ?? 0));

      // If STARTTLS needed and encryption is tls
      const supportsStartTls = ehloText.includes("STARTTLS");

      // Send QUIT
      await conn.write(new TextEncoder().encode("QUIT\r\n"));
      conn.close();

      const details: string[] = [];
      if (greeting.startsWith("220")) details.push("Servidor respondeu corretamente");
      if (ehloText.includes("250")) details.push("EHLO aceito");
      if (supportsStartTls) details.push("STARTTLS disponível");
      if (ehloText.includes("AUTH")) details.push("Autenticação suportada");

      return new Response(
        JSON.stringify({
          success: true,
          message: "Conexão SMTP estabelecida com sucesso!",
          details,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (connErr: any) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Falha ao conectar: ${connErr.message}`,
          details: [`Host: ${host}`, `Porta: ${port}`, `Criptografia: ${encryption}`],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, message: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
