import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/ContextoEmpresa";
import { useToast } from "@/hooks/use-toast";
import { FileText, Save, RotateCcw, Loader2, Info, MessageSquare, Mail } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface Template {
  id?: string;
  type: string;
  template_text: string;
  footer: string;
  active: boolean;
  channel: string;
}

const TEMPLATE_TYPES = [
  {
    type: "reservation_confirmed",
    label: "Reserva Confirmada",
    description: "Enviada quando uma porta é reservada com sucesso",
    variables: ["{nome}", "{porta}", "{armario}", "{data_expiracao}", "{hora_expiracao}"],
  },
  {
    type: "reservation_released",
    label: "Porta Liberada",
    description: "Enviada quando o usuário libera a porta",
    variables: ["{nome}", "{porta}", "{armario}"],
  },
  {
    type: "reservation_expiring",
    label: "Reserva Expirando",
    description: "Enviada quando a reserva está prestes a expirar",
    variables: ["{nome}", "{porta}", "{armario}", "{minutos_restantes}"],
  },
  {
    type: "reservation_expired",
    label: "Reserva Expirada",
    description: "Enviada quando a reserva expirou",
    variables: ["{nome}", "{porta}", "{armario}"],
  },
  {
    type: "reservation_renewed",
    label: "Reserva Renovada",
    description: "Enviada quando a reserva é renovada",
    variables: ["{nome}", "{porta}", "{armario}", "{data_expiracao}", "{hora_expiracao}", "{horas_renovadas}"],
  },
  {
    type: "welcome",
    label: "Boas-vindas",
    description: "Enviada quando uma nova pessoa é cadastrada",
    variables: ["{nome}"],
  },
  {
    type: "waitlist_available",
    label: "Fila de Espera — Vaga Disponível",
    description: "Enviada quando uma porta libera e há alguém na fila de espera",
    variables: ["{nome}", "{porta}", "{armario}"],
  },
];

const WHATSAPP_DEFAULTS: Record<string, { text: string; footer: string }> = {
  reservation_confirmed: {
    text: `Olá, *{nome}*! 👋\n\n✅ *Sua reserva foi confirmada!*\n\n📦 *Porta:* {porta}\n🏢 *Armário:* {armario}\n📅 *Válida até:* {data_expiracao} às {hora_expiracao}\n\nDirija-se ao local e utilize sua porta normalmente. Lembre-se de liberar ao finalizar o uso.`,
    footer: "🔒 Sistema de Armários Inteligentes",
  },
  reservation_released: {
    text: `Olá, *{nome}*! 👋\n\n🔓 *Porta liberada com sucesso!*\n\n📦 *Porta:* {porta}\n🏢 *Armário:* {armario}\n\nSua porta foi liberada e já está disponível para outros usuários. Obrigado por utilizar nosso sistema! 🙏`,
    footer: "🔒 Sistema de Armários Inteligentes",
  },
  reservation_expiring: {
    text: `Olá, *{nome}*! 👋\n\n⚠️ *Atenção! Sua reserva está expirando.*\n\n📦 *Porta:* {porta}\n🏢 *Armário:* {armario}\n⏳ *Tempo restante:* {minutos_restantes} minuto(s)\n\nSua reserva será encerrada automaticamente se não for renovada. Renove agora para continuar usando!`,
    footer: "⏰ Ação necessária — Responda para renovar",
  },
  reservation_expired: {
    text: `Olá, *{nome}*! 👋\n\n❌ *Sua reserva expirou.*\n\n📦 *Porta:* {porta}\n🏢 *Armário:* {armario}\n\nO prazo da sua reserva terminou e a porta foi liberada automaticamente. Caso ainda precise de um espaço, faça uma nova reserva! 📲`,
    footer: "🔒 Sistema de Armários Inteligentes",
  },
  reservation_renewed: {
    text: `Olá, *{nome}*! 👋\n\n🔄 *Reserva renovada com sucesso!*\n\n📦 *Porta:* {porta}\n🏢 *Armário:* {armario}\n⏰ *Novo prazo:* {data_expiracao} às {hora_expiracao}\n➕ *Estendida por:* {horas_renovadas}h\n\nTudo certo! Continue utilizando sua porta tranquilamente. 😊`,
    footer: "🔒 Sistema de Armários Inteligentes",
  },
  welcome: {
    text: `Olá, *{nome}*! 👋\n\n🎉 *Bem-vindo(a) ao nosso sistema!*\n\nÉ um prazer ter você conosco! A partir de agora, você pode utilizar nosso sistema de armários inteligentes para guardar seus pertences com praticidade e segurança. 🔐\n\n📦 *O que você pode fazer:*\n• Reservar portas disponíveis\n• Receber alertas de expiração\n• Renovar reservas pelo celular\n\nCaso tenha dúvidas, estamos à disposição! 😊`,
    footer: "🔒 Sistema de Armários Inteligentes — Boas-vindas",
  },
};

const EMAIL_DEFAULTS: Record<string, { text: string; footer: string }> = {
  reservation_confirmed: {
    text: `<h2>Olá, {nome}! 👋</h2>\n<p>Sua reserva foi <strong>confirmada</strong> com sucesso!</p>\n<table style="margin:16px 0;border-collapse:collapse;">\n  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Porta:</td><td>{porta}</td></tr>\n  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Armário:</td><td>{armario}</td></tr>\n  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Válida até:</td><td>{data_expiracao} às {hora_expiracao}</td></tr>\n</table>\n<p>Dirija-se ao local e utilize sua porta normalmente. Lembre-se de liberar ao finalizar o uso.</p>`,
    footer: "Sistema de Armários Inteligentes — E-mail automático",
  },
  reservation_released: {
    text: `<h2>Olá, {nome}! 👋</h2>\n<p>Sua porta foi <strong>liberada</strong> com sucesso!</p>\n<table style="margin:16px 0;border-collapse:collapse;">\n  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Porta:</td><td>{porta}</td></tr>\n  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Armário:</td><td>{armario}</td></tr>\n</table>\n<p>A porta já está disponível para outros usuários. Obrigado!</p>`,
    footer: "Sistema de Armários Inteligentes — E-mail automático",
  },
  reservation_expiring: {
    text: `<h2>Olá, {nome}! ⚠️</h2>\n<p><strong>Atenção!</strong> Sua reserva está expirando.</p>\n<table style="margin:16px 0;border-collapse:collapse;">\n  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Porta:</td><td>{porta}</td></tr>\n  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Armário:</td><td>{armario}</td></tr>\n  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Tempo restante:</td><td>{minutos_restantes} minuto(s)</td></tr>\n</table>\n<p>Sua reserva será encerrada automaticamente se não for renovada. Entre no sistema para renovar.</p>`,
    footer: "Sistema de Armários Inteligentes — Ação necessária",
  },
  reservation_expired: {
    text: `<h2>Olá, {nome}! 👋</h2>\n<p>Sua reserva <strong>expirou</strong>.</p>\n<table style="margin:16px 0;border-collapse:collapse;">\n  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Porta:</td><td>{porta}</td></tr>\n  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Armário:</td><td>{armario}</td></tr>\n</table>\n<p>A porta foi liberada automaticamente. Faça uma nova reserva pelo sistema se precisar.</p>`,
    footer: "Sistema de Armários Inteligentes — E-mail automático",
  },
  reservation_renewed: {
    text: `<h2>Olá, {nome}! 👋</h2>\n<p>Sua reserva foi <strong>renovada</strong> com sucesso!</p>\n<table style="margin:16px 0;border-collapse:collapse;">\n  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Porta:</td><td>{porta}</td></tr>\n  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Armário:</td><td>{armario}</td></tr>\n  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Novo prazo:</td><td>{data_expiracao} às {hora_expiracao}</td></tr>\n  <tr><td style="padding:4px 12px 4px 0;font-weight:bold;">Estendida por:</td><td>{horas_renovadas}h</td></tr>\n</table>\n<p>Continue utilizando sua porta tranquilamente.</p>`,
    footer: "Sistema de Armários Inteligentes — E-mail automático",
  },
  welcome: {
    text: `<h2>Olá, {nome}! 🎉</h2>\n<p><strong>Bem-vindo(a) ao nosso sistema de armários inteligentes!</strong></p>\n<p>É um prazer ter você conosco! A partir de agora, você pode:</p>\n<ul>\n  <li>Reservar portas disponíveis</li>\n  <li>Receber alertas de expiração</li>\n  <li>Renovar reservas pelo celular</li>\n</ul>\n<p>Caso tenha dúvidas, estamos à disposição!</p>`,
    footer: "Sistema de Armários Inteligentes — Boas-vindas",
  },
};

export default function ConfigTemplatesNotificacoes() {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Record<string, Template>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [channel, setChannel] = useState<"whatsapp" | "email">("whatsapp");

  useEffect(() => {
    if (!selectedCompany) return;
    loadTemplates();
  }, [selectedCompany, channel]);

  const getDefaults = (type: string) => {
    const src = channel === "whatsapp" ? WHATSAPP_DEFAULTS : EMAIL_DEFAULTS;
    return src[type] || { text: "", footer: "" };
  };

  const loadTemplates = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    const { data } = await supabase
      .from("company_notification_templates")
      .select("*")
      .eq("company_id", selectedCompany.id)
      .eq("channel", channel);

    const map: Record<string, Template> = {};
    TEMPLATE_TYPES.forEach((t) => {
      const existing = data?.find((d: any) => d.type === t.type);
      const defaults = getDefaults(t.type);
      map[t.type] = existing
        ? { id: existing.id, type: existing.type, template_text: existing.template_text, footer: existing.footer || defaults.footer, active: existing.active, channel }
        : { type: t.type, template_text: defaults.text, footer: defaults.footer, active: true, channel };
    });
    setTemplates(map);
    setLoading(false);
  };

  const handleSave = async (type: string) => {
    if (!selectedCompany) return;
    setSaving(type);
    const tpl = templates[type];
    try {
      if (tpl.id) {
        await supabase
          .from("company_notification_templates")
          .update({ template_text: tpl.template_text, footer: tpl.footer, active: tpl.active })
          .eq("id", tpl.id);
      } else {
        const { data } = await supabase
          .from("company_notification_templates")
          .insert({ company_id: selectedCompany.id, type, template_text: tpl.template_text, footer: tpl.footer, active: tpl.active, channel })
          .select("id")
          .single();
        if (data) {
          setTemplates((prev) => ({ ...prev, [type]: { ...prev[type], id: data.id } }));
        }
      }
      toast({ title: "Template salvo com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const handleReset = (type: string) => {
    const defaults = getDefaults(type);
    setTemplates((prev) => ({
      ...prev,
      [type]: { ...prev[type], template_text: defaults.text, footer: defaults.footer },
    }));
  };

  const updateTemplate = (type: string, field: keyof Template, value: string | boolean) => {
    setTemplates((prev) => ({ ...prev, [type]: { ...prev[type], [field]: value } }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Templates de Notificações
          </CardTitle>
          <CardDescription>
            Personalize as mensagens enviadas automaticamente via WhatsApp e E-mail. Use variáveis para dados dinâmicos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Channel tabs */}
          <Tabs value={channel} onValueChange={(v) => setChannel(v as "whatsapp" | "email")}>
            <TabsList className="bg-muted/50 rounded-lg">
              <TabsTrigger value="whatsapp" className="gap-2 rounded-md text-sm">
                <MessageSquare className="h-4 w-4" />
                WhatsApp
              </TabsTrigger>
              <TabsTrigger value="email" className="gap-2 rounded-md text-sm">
                <Mail className="h-4 w-4" />
                E-mail
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="rounded-lg bg-muted/50 p-3 flex items-start gap-2">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              Variáveis entre chaves (ex: <code className="bg-muted px-1 rounded">{"{nome}"}</code>) são substituídas pelos dados reais.
              {channel === "whatsapp" ? (
                <> Use <code className="bg-muted px-1 rounded">*texto*</code> para <strong>negrito</strong> e <code className="bg-muted px-1 rounded">_texto_</code> para <em>itálico</em>.</>
              ) : (
                <> Use HTML para formatação: <code className="bg-muted px-1 rounded">{"<strong>"}</code> para <strong>negrito</strong>, <code className="bg-muted px-1 rounded">{"<em>"}</code> para <em>itálico</em>.</>
              )}
            </p>
          </div>

          <Accordion type="single" collapsible className="w-full">
            {TEMPLATE_TYPES.map((tplType) => {
              const tpl = templates[tplType.type];
              if (!tpl) return null;
              return (
                <AccordionItem value={tplType.type} key={tplType.type}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{tplType.label}</span>
                      {!tpl.active && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">Desativado</Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-2">
                    <p className="text-xs text-muted-foreground">{tplType.description}</p>

                    <div className="flex flex-wrap gap-1.5">
                      {tplType.variables.map((v) => (
                        <Badge key={v} variant="secondary" className="text-xs font-mono cursor-pointer hover:bg-accent"
                          onClick={() => {
                            navigator.clipboard.writeText(v);
                            toast({ title: `Variável ${v} copiada!` });
                          }}>
                          {v}
                        </Badge>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">
                        {channel === "whatsapp" ? "Mensagem" : "Corpo do E-mail (HTML)"}
                      </Label>
                      <Textarea
                        rows={channel === "email" ? 12 : 8}
                        value={tpl.template_text}
                        onChange={(e) => updateTemplate(tplType.type, "template_text", e.target.value)}
                        className="font-mono text-xs"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Rodapé</Label>
                      <Input
                        value={tpl.footer}
                        onChange={(e) => updateTemplate(tplType.type, "footer", e.target.value)}
                        className="text-xs"
                        placeholder="Texto do rodapé"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={tpl.active}
                          onCheckedChange={(checked) => updateTemplate(tplType.type, "active", checked)}
                        />
                        <Label className="text-xs">{tpl.active ? "Ativo" : "Desativado"}</Label>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleReset(tplType.type)}>
                          <RotateCcw className="h-3 w-3 mr-1" /> Restaurar padrão
                        </Button>
                        <Button size="sm" onClick={() => handleSave(tplType.type)} disabled={saving === tplType.type}>
                          {saving === tplType.type ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                          Salvar
                        </Button>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
