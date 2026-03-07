import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/ContextoAutenticacao";
import { Mail, Server, Eye, Save, Loader2, Send, Palette, Plug, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SmtpConfig {
  host: string;
  port: string;
  user: string;
  password: string;
  from_email: string;
  from_name: string;
  encryption: string;
  enabled: boolean;
}

interface EmailTemplate {
  subject: string;
  heading: string;
  body: string;
  button_text: string;
  footer: string;
  primary_color: string;
  logo_url: string;
}

const defaultSmtp: SmtpConfig = {
  host: "",
  port: "587",
  user: "",
  password: "",
  from_email: "",
  from_name: "Locker System",
  encryption: "tls",
  enabled: false,
};

const defaultTemplate: EmailTemplate = {
  subject: "Recuperação de Senha",
  heading: "Redefinir sua senha",
  body: "Recebemos uma solicitação para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha. Se você não fez esta solicitação, ignore este e-mail.",
  button_text: "Redefinir Senha",
  footer: "Este link expira em 1 hora. Se precisar de ajuda, entre em contato com o suporte.",
  primary_color: "#2563eb",
  logo_url: "",
};

export default function ConfigEmail() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [smtp, setSmtp] = useState<SmtpConfig>(defaultSmtp);
  const [template, setTemplate] = useState<EmailTemplate>(defaultTemplate);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{ success: boolean; message: string; details?: string[] } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data: smtpData } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "smtp_config")
      .maybeSingle();

    if (smtpData?.value) {
      setSmtp({ ...defaultSmtp, ...(smtpData.value as unknown as Partial<SmtpConfig>) });
    }

    const { data: templateData } = await supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "recovery_email_template")
      .maybeSingle();

    if (templateData?.value) {
      setTemplate({ ...defaultTemplate, ...(templateData.value as unknown as Partial<EmailTemplate>) });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Upsert SMTP config
      const { error: smtpErr } = await supabase
        .from("platform_settings")
        .upsert({ key: "smtp_config", value: smtp as any }, { onConflict: "key" });
      if (smtpErr) throw smtpErr;

      // Upsert template
      const { error: templateErr } = await supabase
        .from("platform_settings")
        .upsert({ key: "recovery_email_template", value: template as any }, { onConflict: "key" });
      if (templateErr) throw templateErr;

      toast({ title: "Configurações salvas com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!smtp.host || !smtp.port) {
      toast({ title: "Preencha o servidor e a porta", variant: "destructive" });
      return;
    }
    setTestingConnection(true);
    setConnectionResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("test-smtp", {
        body: {
          host: smtp.host,
          port: smtp.port,
          user: smtp.user,
          password: smtp.password,
          encryption: smtp.encryption,
        },
      });
      if (error) throw error;
      setConnectionResult(data);
      toast({
        title: data.success ? "Conexão bem-sucedida!" : "Falha na conexão",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    } catch (err: any) {
      setConnectionResult({ success: false, message: err.message });
      toast({ title: "Erro ao testar conexão", description: err.message, variant: "destructive" });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmail) {
      toast({ title: "Informe um e-mail para teste", variant: "destructive" });
      return;
    }
    setSendingTest(true);
    try {
      if (smtp.enabled && smtp.host) {
        // Send via custom SMTP
        const primaryColor = template.primary_color || "#2563eb";
        const fromName = smtp.from_name || "Sistema";
        const html = `
          <div style="max-width:520px;margin:0 auto;font-family:'Segoe UI',Arial,sans-serif;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
            <div style="background:${primaryColor};padding:32px 24px;text-align:center;">
              ${template.logo_url ? `<img src="${template.logo_url}" alt="Logo" style="height:40px;margin-bottom:16px;" />` : ""}
              <h1 style="color:#ffffff;font-size:22px;margin:0;font-weight:700;">${template.heading}</h1>
            </div>
            <div style="padding:32px 24px;">
              <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px;">${template.body}</p>
              <div style="text-align:center;margin:24px 0;">
                <a href="#" style="display:inline-block;background:${primaryColor};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">${template.button_text}</a>
              </div>
              <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:24px 0 0;text-align:center;">${template.footer}</p>
            </div>
            <div style="background:#f9fafb;padding:16px 24px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="color:#9ca3af;font-size:12px;margin:0;">© ${new Date().getFullYear()} ${fromName}</p>
            </div>
          </div>
        `;

        const { data, error } = await supabase.functions.invoke("send-smtp-email", {
          body: { to: testEmail, subject: template.subject, html },
        });

        if (error) throw error;
        if (data && !data.success) throw new Error(data.message);

        toast({ title: "E-mail de teste enviado via SMTP!", description: `Verifique a caixa de entrada de ${testEmail}` });
      } else {
        // Fallback to built-in
        const { error } = await supabase.auth.resetPasswordForEmail(testEmail, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) throw error;
        toast({ title: "E-mail de teste enviado!", description: `Verifique a caixa de entrada de ${testEmail} (via sistema padrão)` });
      }
    } catch (err: any) {
      toast({ title: "Erro ao enviar e-mail de teste", description: err.message, variant: "destructive" });
    } finally {
      setSendingTest(false);
    }
  };

  const previewHtml = `
    <div style="max-width:520px;margin:0 auto;font-family:'Segoe UI',Arial,sans-serif;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:${template.primary_color};padding:32px 24px;text-align:center;">
        ${template.logo_url ? `<img src="${template.logo_url}" alt="Logo" style="height:40px;margin-bottom:16px;" />` : ""}
        <h1 style="color:#ffffff;font-size:22px;margin:0;font-weight:700;">${template.heading}</h1>
      </div>
      <div style="padding:32px 24px;">
        <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 24px;">${template.body}</p>
        <div style="text-align:center;margin:24px 0;">
          <a href="#" style="display:inline-block;background:${template.primary_color};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">${template.button_text}</a>
        </div>
        <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:24px 0 0;text-align:center;">${template.footer}</p>
      </div>
      <div style="background:#f9fafb;padding:16px 24px;text-align:center;border-top:1px solid #e5e7eb;">
        <p style="color:#9ca3af;font-size:12px;margin:0;">© ${new Date().getFullYear()} ${smtp.from_name || "Locker System"}</p>
      </div>
    </div>
  `;

  return (
    <div className="space-y-6">
      {/* SMTP Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Configuração SMTP
          </CardTitle>
          <CardDescription>Configure o servidor de e-mail para envio de notificações e recuperação de senha</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
            <div>
              <p className="text-sm font-medium">Ativar SMTP personalizado</p>
              <p className="text-xs text-muted-foreground">Usar servidor próprio em vez do padrão da plataforma</p>
            </div>
            <Switch checked={smtp.enabled} onCheckedChange={(v) => setSmtp({ ...smtp, enabled: v })} />
          </div>

          <div className={`space-y-4 transition-opacity ${smtp.enabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Servidor SMTP</Label>
                <Input placeholder="smtp.gmail.com" value={smtp.host} onChange={(e) => setSmtp({ ...smtp, host: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Porta</Label>
                <Input placeholder="587" value={smtp.port} onChange={(e) => setSmtp({ ...smtp, port: e.target.value })} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Usuário</Label>
                <Input placeholder="usuario@email.com" value={smtp.user} onChange={(e) => setSmtp({ ...smtp, user: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Senha</Label>
                <Input type="password" placeholder="••••••••" value={smtp.password} onChange={(e) => setSmtp({ ...smtp, password: e.target.value })} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>E-mail remetente</Label>
                <Input placeholder="noreply@suaempresa.com" value={smtp.from_email} onChange={(e) => setSmtp({ ...smtp, from_email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Nome remetente</Label>
                <Input placeholder="Locker System" value={smtp.from_name} onChange={(e) => setSmtp({ ...smtp, from_name: e.target.value })} />
              </div>
            </div>

            <div className="space-y-2 sm:w-1/2">
              <Label>Criptografia</Label>
              <Select value={smtp.encryption} onValueChange={(v) => setSmtp({ ...smtp, encryption: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tls">TLS</SelectItem>
                  <SelectItem value="ssl">SSL</SelectItem>
                  <SelectItem value="none">Nenhuma</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="flex items-center gap-3 flex-wrap">
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={testingConnection || !smtp.host || !smtp.port}
                className="gap-2"
              >
                {testingConnection ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                Testar conexão
              </Button>

              {connectionResult && (
                <Badge
                  variant="outline"
                  className={connectionResult.success
                    ? "text-green-600 border-green-300 bg-green-50 gap-1.5"
                    : "text-destructive border-destructive/30 bg-destructive/10 gap-1.5"
                  }
                >
                  {connectionResult.success ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                  {connectionResult.message}
                </Badge>
              )}
            </div>

            {connectionResult?.details && connectionResult.details.length > 0 && (
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Detalhes da conexão:</p>
                <ul className="space-y-1">
                  {connectionResult.details.map((d, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span className={connectionResult.success ? "text-green-500" : "text-muted-foreground"}>•</span>
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Email Template */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Template de Recuperação de Senha
          </CardTitle>
          <CardDescription>Personalize o layout do e-mail de recuperação de senha</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Assunto do e-mail</Label>
              <Input value={template.subject} onChange={(e) => setTemplate({ ...template, subject: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Cor principal</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={template.primary_color}
                  onChange={(e) => setTemplate({ ...template, primary_color: e.target.value })}
                  className="h-10 w-12 rounded-md border border-input cursor-pointer"
                />
                <Input value={template.primary_color} onChange={(e) => setTemplate({ ...template, primary_color: e.target.value })} className="flex-1" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>URL do logo (opcional)</Label>
            <Input placeholder="https://suaempresa.com/logo.png" value={template.logo_url} onChange={(e) => setTemplate({ ...template, logo_url: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label>Título do e-mail</Label>
            <Input value={template.heading} onChange={(e) => setTemplate({ ...template, heading: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label>Corpo do e-mail</Label>
            <Textarea rows={3} value={template.body} onChange={(e) => setTemplate({ ...template, body: e.target.value })} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Texto do botão</Label>
              <Input value={template.button_text} onChange={(e) => setTemplate({ ...template, button_text: e.target.value })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Rodapé</Label>
            <Textarea rows={2} value={template.footer} onChange={(e) => setTemplate({ ...template, footer: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Preview do E-mail
          </CardTitle>
          <CardDescription>Visualize como o e-mail de recuperação aparecerá para o usuário</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-border bg-muted/30 p-6 overflow-auto">
            <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        </CardContent>
      </Card>

      {/* Test email */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Enviar E-mail de Teste
          </CardTitle>
          <CardDescription>Envie um e-mail de recuperação para testar a configuração</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input placeholder="email@teste.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} className="flex-1" />
            <Button variant="outline" onClick={handleSendTest} disabled={sendingTest} className="gap-2">
              {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Enviar teste
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar configurações
        </Button>
      </div>
    </div>
  );
}
