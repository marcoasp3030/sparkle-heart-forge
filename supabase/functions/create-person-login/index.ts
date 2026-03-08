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

    const { person_id, email, password, send_whatsapp = true, send_email = true } = await req.json();

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
      .select("id, nome, company_id, user_id, telefone, email")
      .eq("id", person_id)
      .single();

    if (personError || !person) {
      return new Response(JSON.stringify({ error: "Pessoa não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    let userId: string;

    if (createError) {
      if (createError.message.includes("already been registered")) {
        const { data: { users } } = await adminClient.auth.admin.listUsers();
        const existing = users?.find((u: any) => u.email === email);
        if (!existing) {
          return new Response(JSON.stringify({ error: "Usuário existe mas não foi possível localizá-lo" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        userId = existing.id;
        await adminClient.auth.admin.updateUserById(userId, { password });
      } else {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      userId = newUser.user.id;
    }

    // Update profile with company_id, role 'user', and password_changed = false
    await adminClient
      .from("profiles")
      .update({ company_id: person.company_id, role: "user", full_name: person.nome, password_changed: false })
      .eq("user_id", userId);

    // Link person record to auth user
    await adminClient
      .from("funcionarios_clientes")
      .update({ user_id: userId, email })
      .eq("id", person_id);

    // ====== SEND CREDENTIALS NOTIFICATIONS (fire-and-forget) ======
    const notifications: { channel: string; success: boolean; reason?: string }[] = [];
    const firstName = person.nome?.split(" ")[0] || "";

    // --- WhatsApp notification ---
    if (send_whatsapp && person.telefone) {
      try {
        // Build credentials message for WhatsApp
        const whatsappText = buildWhatsAppCredentialsMessage(firstName, email, password);

        // Get company WhatsApp config
        const { data: companyWa } = await adminClient
          .from("company_whatsapp")
          .select("*")
          .eq("company_id", person.company_id)
          .single();

        if (companyWa?.status === "connected" && companyWa?.instance_token) {
          const { data: serverUrlSetting } = await adminClient
            .from("platform_settings")
            .select("value")
            .eq("key", "uazapi_server_url")
            .single();

          const serverUrl = serverUrlSetting?.value as string;
          if (serverUrl) {
            const baseUrl = (serverUrl as string).replace(/\/$/, "");
            const phone = normalizePhone(person.telefone);

            if (phone.length >= 12 && phone.length <= 13) {
              const response = await fetch(`${baseUrl}/send/text`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "token": String(companyWa.instance_token) },
                body: JSON.stringify({ number: phone, text: whatsappText }),
              });
              await response.text();
              notifications.push({ channel: "whatsapp", success: response.ok });
            } else {
              notifications.push({ channel: "whatsapp", success: false, reason: "invalid_phone" });
            }
          } else {
            notifications.push({ channel: "whatsapp", success: false, reason: "uazapi_not_configured" });
          }
        } else {
          notifications.push({ channel: "whatsapp", success: false, reason: "whatsapp_not_connected" });
        }
      } catch (waErr) {
        console.error("WhatsApp credentials notification error:", waErr);
        notifications.push({ channel: "whatsapp", success: false, reason: "error" });
      }
    }

    // --- Email notification ---
    if (send_email) {
      try {
        const { data: smtpSetting } = await adminClient
          .from("platform_settings")
          .select("value")
          .eq("key", "smtp_config")
          .maybeSingle();

        const smtpConfig = smtpSetting?.value as Record<string, any> | null;

        if (smtpConfig?.enabled && smtpConfig?.host && smtpConfig?.port) {
          // Call send-smtp-email function directly using SMTP
          const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");

          const portNum = parseInt(smtpConfig.port, 10);
          const useTls = smtpConfig.encryption === "tls" || smtpConfig.encryption === "ssl";

          const smtpClient = new SMTPClient({
            connection: {
              hostname: smtpConfig.host,
              port: portNum,
              tls: useTls,
              auth: smtpConfig.user && smtpConfig.password
                ? { username: smtpConfig.user, password: smtpConfig.password }
                : undefined,
            },
          });

          const htmlContent = buildEmailCredentialsHtml(firstName, person.nome, email, password);

          await smtpClient.send({
            from: `${smtpConfig.from_name || "Sistema de Armários"} <${smtpConfig.from_email || smtpConfig.user}>`,
            to: email,
            subject: "🔐 Suas credenciais de acesso ao sistema",
            content: "Visualize este e-mail em um cliente com suporte a HTML.",
            html: htmlContent,
          });

          await smtpClient.close();
          notifications.push({ channel: "email", success: true });
        } else {
          notifications.push({ channel: "email", success: false, reason: "smtp_not_configured" });
        }
      } catch (emailErr) {
        console.error("Email credentials notification error:", emailErr);
        notifications.push({ channel: "email", success: false, reason: "error" });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        message: `Acesso criado para ${person.nome}`,
        notifications,
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

// ====== Helper functions ======

function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (!digits.startsWith("55")) {
    digits = `55${digits}`;
  }
  if (digits.length === 12) {
    const areaCode = digits.slice(2, 4);
    const number = digits.slice(4);
    if (number.length === 8 && parseInt(number[0]) >= 6) {
      digits = `55${areaCode}9${number}`;
    }
  }
  return digits;
}

function buildWhatsAppCredentialsMessage(firstName: string, email: string, password: string): string {
  return `Olá, *${firstName}*! 👋

🔐 *Seu acesso ao sistema foi criado!*

Aqui estão suas credenciais de login:

📧 *E-mail:* ${email}
🔑 *Senha:* ${password}

━━━━━━━━━━━━━━━━━━

⚠️ *Importante:*
• Acesse o sistema e altere sua senha no primeiro acesso
• Não compartilhe suas credenciais com ninguém
• Em caso de dúvidas, entre em contato com o administrador

_🔒 Sistema de Armários Inteligentes_`;
}

function buildEmailCredentialsHtml(firstName: string, fullName: string, email: string, password: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr><td style="background:linear-gradient(135deg,#c026d3,#e040a0);padding:24px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;">🔐 Acesso ao Sistema Criado</h1>
        </td></tr>
        <tr><td style="padding:32px;color:#1f2937;font-size:14px;line-height:1.7;">
          <h2 style="margin:0 0 16px;">Olá, ${firstName}! 👋</h2>
          <p>Seu acesso ao <strong>Sistema de Armários Inteligentes</strong> foi criado com sucesso!</p>
          <p>Utilize as credenciais abaixo para fazer login:</p>

          <table style="margin:20px 0;border-collapse:collapse;width:100%;background-color:#f9fafb;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="padding:12px 16px;font-weight:bold;color:#6b7280;border-bottom:1px solid #e5e7eb;width:120px;">Nome</td>
              <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">${fullName}</td>
            </tr>
            <tr>
              <td style="padding:12px 16px;font-weight:bold;color:#6b7280;border-bottom:1px solid #e5e7eb;">E-mail</td>
              <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;"><code style="background:#e5e7eb;padding:2px 6px;border-radius:4px;">${email}</code></td>
            </tr>
            <tr>
              <td style="padding:12px 16px;font-weight:bold;color:#6b7280;">Senha</td>
              <td style="padding:12px 16px;"><code style="background:#fef3c7;padding:2px 6px;border-radius:4px;color:#92400e;">${password}</code></td>
            </tr>
          </table>

          <div style="background-color:#fef9c3;border-left:4px solid #eab308;padding:12px 16px;border-radius:0 8px 8px 0;margin:20px 0;">
            <strong style="color:#854d0e;">⚠️ Importante:</strong>
            <ul style="margin:8px 0 0;padding-left:20px;color:#854d0e;">
              <li>Altere sua senha no primeiro acesso</li>
              <li>Não compartilhe suas credenciais com ninguém</li>
              <li>Em caso de dúvidas, contate o administrador</li>
            </ul>
          </div>
        </td></tr>
        <tr><td style="padding:16px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">🔒 Sistema de Armários Inteligentes — E-mail automático</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
