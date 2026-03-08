import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/ContextoEmpresa";
import { useToast } from "@/hooks/use-toast";
import { FileText, Save, RotateCcw, Loader2, Info } from "lucide-react";
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
}

const TEMPLATE_TYPES = [
  {
    type: "reservation_confirmed",
    label: "Reserva Confirmada",
    description: "Enviada quando uma porta é reservada com sucesso",
    variables: ["{nome}", "{porta}", "{armario}", "{data_expiracao}", "{hora_expiracao}"],
    defaultText: `Olá, *{nome}*! 👋

✅ *Sua reserva foi confirmada!*

📦 *Porta:* {porta}
🏢 *Armário:* {armario}
📅 *Válida até:* {data_expiracao} às {hora_expiracao}

Dirija-se ao local e utilize sua porta normalmente. Lembre-se de liberar ao finalizar o uso.`,
  },
  {
    type: "reservation_released",
    label: "Porta Liberada",
    description: "Enviada quando o usuário libera a porta",
    variables: ["{nome}", "{porta}", "{armario}"],
    defaultText: `Olá, *{nome}*! 👋

🔓 *Porta liberada com sucesso!*

📦 *Porta:* {porta}
🏢 *Armário:* {armario}

Sua porta foi liberada e já está disponível para outros usuários. Obrigado por utilizar nosso sistema! 🙏`,
  },
  {
    type: "reservation_expiring",
    label: "Reserva Expirando",
    description: "Enviada quando a reserva está prestes a expirar",
    variables: ["{nome}", "{porta}", "{armario}", "{minutos_restantes}"],
    defaultText: `Olá, *{nome}*! 👋

⚠️ *Atenção! Sua reserva está expirando.*

📦 *Porta:* {porta}
🏢 *Armário:* {armario}
⏳ *Tempo restante:* {minutos_restantes} minuto(s)

Sua reserva será encerrada automaticamente se não for renovada. Renove agora para continuar usando!`,
  },
  {
    type: "reservation_expired",
    label: "Reserva Expirada",
    description: "Enviada quando a reserva expirou",
    variables: ["{nome}", "{porta}", "{armario}"],
    defaultText: `Olá, *{nome}*! 👋

❌ *Sua reserva expirou.*

📦 *Porta:* {porta}
🏢 *Armário:* {armario}

O prazo da sua reserva terminou e a porta foi liberada automaticamente. Caso ainda precise de um espaço, faça uma nova reserva! 📲`,
  },
  {
    type: "reservation_renewed",
    label: "Reserva Renovada",
    description: "Enviada quando a reserva é renovada",
    variables: ["{nome}", "{porta}", "{armario}", "{data_expiracao}", "{hora_expiracao}", "{horas_renovadas}"],
    defaultText: `Olá, *{nome}*! 👋

🔄 *Reserva renovada com sucesso!*

📦 *Porta:* {porta}
🏢 *Armário:* {armario}
⏰ *Novo prazo:* {data_expiracao} às {hora_expiracao}
➕ *Estendida por:* {horas_renovadas}h

Tudo certo! Continue utilizando sua porta tranquilamente. 😊`,
  },
  {
    type: "welcome",
    label: "Boas-vindas",
    description: "Enviada quando uma nova pessoa é cadastrada",
    variables: ["{nome}"],
    defaultText: `Olá, *{nome}*! 👋

🎉 *Bem-vindo(a) ao nosso sistema!*

É um prazer ter você conosco! A partir de agora, você pode utilizar nosso sistema de armários inteligentes para guardar seus pertences com praticidade e segurança. 🔐

📦 *O que você pode fazer:*
• Reservar portas disponíveis
• Receber alertas de expiração
• Renovar reservas pelo celular

Caso tenha dúvidas, estamos à disposição! 😊`,
  },
];

const DEFAULT_FOOTER = "🔒 Sistema de Armários Inteligentes";

export default function ConfigTemplatesWhatsApp() {
  const { selectedCompany } = useCompany();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Record<string, Template>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedCompany) return;
    loadTemplates();
  }, [selectedCompany]);

  const loadTemplates = async () => {
    if (!selectedCompany) return;
    setLoading(true);
    const { data } = await supabase
      .from("company_notification_templates")
      .select("*")
      .eq("company_id", selectedCompany.id);

    const map: Record<string, Template> = {};
    TEMPLATE_TYPES.forEach((t) => {
      const existing = data?.find((d: any) => d.type === t.type);
      map[t.type] = existing
        ? { id: existing.id, type: existing.type, template_text: existing.template_text, footer: existing.footer || DEFAULT_FOOTER, active: existing.active }
        : { type: t.type, template_text: t.defaultText, footer: DEFAULT_FOOTER, active: true };
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
          .insert({ company_id: selectedCompany.id, type, template_text: tpl.template_text, footer: tpl.footer, active: tpl.active })
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
    const def = TEMPLATE_TYPES.find((t) => t.type === type);
    if (!def) return;
    setTemplates((prev) => ({
      ...prev,
      [type]: { ...prev[type], template_text: def.defaultText, footer: DEFAULT_FOOTER },
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
            Templates de Notificações WhatsApp
          </CardTitle>
          <CardDescription>
            Personalize as mensagens enviadas automaticamente via WhatsApp. Use as variáveis disponíveis para inserir dados dinâmicos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-muted/50 p-3 mb-4 flex items-start gap-2">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              As variáveis entre chaves (ex: <code className="bg-muted px-1 rounded">{"{nome}"}</code>) serão substituídas automaticamente pelos dados reais ao enviar a mensagem.
              Use <code className="bg-muted px-1 rounded">*texto*</code> para <strong>negrito</strong> e <code className="bg-muted px-1 rounded">_texto_</code> para <em>itálico</em>.
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
                      <Label className="text-xs">Mensagem</Label>
                      <Textarea
                        rows={8}
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
                        placeholder="Texto do rodapé da mensagem"
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
