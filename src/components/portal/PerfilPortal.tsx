import { useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  User, Mail, Phone, KeyRound, Building2, BadgeCheck,
  Camera, Pencil, Save, X, Bell, BellOff, MessageSquare,
  Clock, RefreshCw, Loader2
} from "lucide-react";
import { supabase } from "@/lib/supabase-compat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface PersonInfo {
  id: string;
  nome: string;
  cargo: string | null;
  tipo: string;
  company_id: string;
  email: string | null;
  telefone: string | null;
  matricula: string | null;
  avatar_url?: string | null;
  notification_email?: boolean;
  notification_whatsapp?: boolean;
  notification_expiry?: boolean;
  notification_renewal?: boolean;
}

interface PerfilPortalProps {
  person: PersonInfo;
  userEmail: string | null;
  companyName: string;
  initials: string;
  onPersonUpdate: (updated: PersonInfo) => void;
}

export default function PerfilPortal({ person, userEmail, companyName, initials, onPersonUpdate }: PerfilPortalProps) {
  const [editing, setEditing] = useState(false);
  const [telefone, setTelefone] = useState(person.telefone || "");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(person.avatar_url || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notification prefs
  const [notifEmail, setNotifEmail] = useState(person.notification_email ?? true);
  const [notifWhatsapp, setNotifWhatsapp] = useState(person.notification_whatsapp ?? true);
  const [notifExpiry, setNotifExpiry] = useState(person.notification_expiry ?? true);
  const [notifRenewal, setNotifRenewal] = useState(person.notification_renewal ?? true);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 2MB");
      return;
    }

    setUploadingAvatar(true);
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) throw new Error("Não autenticado");

      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(path);

      const url = `${publicUrl}?t=${Date.now()}`;

      await supabase
        .from("funcionarios_clientes")
        .update({ avatar_url: url })
        .eq("id", person.id);

      setAvatarUrl(url);
      onPersonUpdate({ ...person, avatar_url: url });
      toast.success("Foto atualizada!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar foto");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("funcionarios_clientes")
        .update({
          telefone: telefone.trim() || null,
          notification_email: notifEmail,
          notification_whatsapp: notifWhatsapp,
          notification_expiry: notifExpiry,
          notification_renewal: notifRenewal,
        })
        .eq("id", person.id);

      if (error) throw error;

      onPersonUpdate({
        ...person,
        telefone: telefone.trim() || null,
        notification_email: notifEmail,
        notification_whatsapp: notifWhatsapp,
        notification_expiry: notifExpiry,
        notification_renewal: notifRenewal,
      });
      setEditing(false);
      toast.success("Perfil atualizado!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setTelefone(person.telefone || "");
    setNotifEmail(person.notification_email ?? true);
    setNotifWhatsapp(person.notification_whatsapp ?? true);
    setNotifExpiry(person.notification_expiry ?? true);
    setNotifRenewal(person.notification_renewal ?? true);
    setEditing(false);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* Avatar card */}
      <Card className="shadow-card border-border/50 overflow-hidden">
        <CardContent className="p-0">
          <div className="gradient-primary p-6 flex flex-col items-center relative">
            {/* Avatar with upload */}
            <div className="relative group">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="h-20 w-20 rounded-full object-cover shadow-lg border-2 border-white/20"
                />
              ) : (
                <div className="h-20 w-20 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-primary-foreground text-2xl font-bold shadow-lg">
                  {initials}
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
              >
                {uploadingAvatar ? (
                  <Loader2 className="h-5 w-5 text-white animate-spin" />
                ) : (
                  <Camera className="h-5 w-5 text-white" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>
            <h2 className="text-primary-foreground font-bold text-lg mt-3">{person.nome}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge className="bg-white/20 text-primary-foreground border-0 text-xs">
                {person.tipo === "funcionario" ? "Funcionário" : "Cliente"}
              </Badge>
              {person.cargo && (
                <Badge className="bg-white/10 text-primary-foreground/80 border-0 text-xs">
                  {person.cargo}
                </Badge>
              )}
            </div>
            <p className="text-primary-foreground/60 text-[11px] mt-2">
              Toque na foto para alterar
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Info card */}
      <Card className="shadow-card border-border/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-primary" />
              Informações Pessoais
            </CardTitle>
            {!editing ? (
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={() => setEditing(true)}>
                <Pencil className="h-3 w-3" />
                Editar
              </Button>
            ) : (
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={handleCancel}>
                  <X className="h-3 w-3" />
                </Button>
                <Button size="sm" className="text-xs h-7 gap-1" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Salvar
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            {/* Nome - read only */}
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Nome Completo</p>
                <p className="text-sm font-medium text-foreground truncate">{person.nome}</p>
              </div>
            </div>

            <Separator />

            {/* Email - read only */}
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
                <Mail className="h-4 w-4 text-secondary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">E-mail</p>
                <p className="text-sm font-medium text-foreground truncate">
                  {person.email || userEmail || "Não informado"}
                </p>
              </div>
            </div>

            <Separator />

            {/* Telefone - editable */}
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                <Phone className="h-4 w-4 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Telefone</p>
                {editing ? (
                  <Input
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    className="h-8 text-sm mt-1"
                  />
                ) : (
                  <p className="text-sm font-medium text-foreground">
                    {person.telefone || "Não informado"}
                  </p>
                )}
              </div>
            </div>

            {person.matricula && (
              <>
                <Separator />
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <KeyRound className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Matrícula</p>
                    <p className="text-sm font-medium text-foreground">{person.matricula}</p>
                  </div>
                </div>
              </>
            )}

            <Separator />

            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Empresa</p>
                <p className="text-sm font-medium text-foreground">{companyName}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card className="shadow-card border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            Preferências de Notificação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-secondary/10 flex items-center justify-center flex-shrink-0">
                  <Mail className="h-4 w-4 text-secondary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">E-mail</p>
                  <p className="text-[11px] text-muted-foreground">Receber notificações por e-mail</p>
                </div>
              </div>
              <Switch
                checked={notifEmail}
                onCheckedChange={(v) => { setNotifEmail(v); if (!editing) setEditing(true); }}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                  <MessageSquare className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">WhatsApp</p>
                  <p className="text-[11px] text-muted-foreground">Receber notificações por WhatsApp</p>
                </div>
              </div>
              <Switch
                checked={notifWhatsapp}
                onCheckedChange={(v) => { setNotifWhatsapp(v); if (!editing) setEditing(true); }}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <Clock className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Expiração</p>
                  <p className="text-[11px] text-muted-foreground">Alertas de prazo expirando</p>
                </div>
              </div>
              <Switch
                checked={notifExpiry}
                onCheckedChange={(v) => { setNotifExpiry(v); if (!editing) setEditing(true); }}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <RefreshCw className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Renovações</p>
                  <p className="text-[11px] text-muted-foreground">Status de solicitações de renovação</p>
                </div>
              </div>
              <Switch
                checked={notifRenewal}
                onCheckedChange={(v) => { setNotifRenewal(v); if (!editing) setEditing(true); }}
              />
            </div>
          </div>

          {editing && (
            <div className="pt-2">
              <Button size="sm" className="w-full gap-1.5" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar Preferências
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
