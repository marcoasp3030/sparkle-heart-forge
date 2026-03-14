import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-compat";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose
} from "@/components/ui/dialog";
import {
  Tabs, TabsContent, TabsList, TabsTrigger
} from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import {
  Settings2, Shield, Archive, Users, Building, Layers, LayoutDashboard,
  History, RefreshCw, ShieldCheck, Bell, MessageSquare, Mail, Palette,
  Save, Loader2, FolderOpen, Plus, Trash2, Copy, ChevronDown, Droplets, Clock
} from "lucide-react";

// ─── Permission Categories ───────────────────────────────────
export interface PermissionDef {
  key: string;
  label: string;
  description: string;
  icon: any;
  category: string;
}

const PERMISSION_CATEGORIES = [
  { key: "modulos", label: "Módulos", icon: LayoutDashboard, description: "Controle quais seções do sistema estarão visíveis" },
  { key: "funcionalidades", label: "Funcionalidades", icon: Settings2, description: "Ative recursos avançados para a empresa" },
  { key: "notificacoes", label: "Notificações", icon: Bell, description: "Configure canais de notificação disponíveis" },
  { key: "personalizacao", label: "Personalização", icon: Palette, description: "Permissões de customização visual" },
];

export const ALL_PERMISSIONS: PermissionDef[] = [
  // Módulos
  { key: "manage_lockers", label: "Armários", description: "Gerenciar e reservar portas de armários", icon: Archive, category: "modulos" },
  { key: "manage_employees", label: "Pessoas", description: "Cadastrar e gerenciar funcionários/clientes", icon: Users, category: "modulos" },
  { key: "manage_departments", label: "Departamentos", description: "Gerenciar departamentos da empresa", icon: Building, category: "modulos" },
  { key: "manage_sectors", label: "Setores", description: "Gerenciar setores vinculados a departamentos", icon: Layers, category: "modulos" },
  { key: "view_dashboard", label: "Dashboard", description: "Acesso ao painel de controle e gráficos", icon: LayoutDashboard, category: "modulos" },
  { key: "view_history", label: "Histórico de Portas", description: "Visualizar histórico de uso das portas", icon: History, category: "modulos" },
  { key: "manage_renewals", label: "Renovações", description: "Solicitar e gerenciar renovações de uso", icon: RefreshCw, category: "modulos" },
  { key: "view_audit", label: "Auditoria", description: "Acessar logs de auditoria da empresa", icon: ShieldCheck, category: "modulos" },

  // Funcionalidades
  { key: "waitlist_enabled", label: "Fila de Espera", description: "Permitir fila de espera quando não há portas disponíveis", icon: Clock, category: "funcionalidades" },
  { key: "hygienization_enabled", label: "Higienização Pós-Uso", description: "Ativar período de higienização automática após liberação", icon: Droplets, category: "funcionalidades" },
  { key: "google_login", label: "Login com Google", description: "Permitir login via conta Google", icon: Shield, category: "funcionalidades" },
  { key: "portal_access", label: "Portal do Usuário", description: "Habilitar acesso ao portal de autoatendimento", icon: Users, category: "funcionalidades" },

  // Notificações
  { key: "notify_whatsapp", label: "WhatsApp", description: "Enviar notificações via WhatsApp", icon: MessageSquare, category: "notificacoes" },
  { key: "notify_email", label: "E-mail", description: "Enviar notificações via e-mail", icon: Mail, category: "notificacoes" },

  // Personalização
  { key: "white_label", label: "White Label", description: "Personalizar logotipos, cores e textos exclusivos", icon: Palette, category: "personalizacao" },
];

// ─── Built-in Presets ───────────────────────────────────────
const BUILTIN_PRESETS: Record<string, { name: string; description: string; permissions: Record<string, boolean> }> = {
  basic: {
    name: "Básico",
    description: "Acesso essencial: armários e pessoas",
    permissions: {
      manage_lockers: true, manage_employees: true, view_dashboard: true,
      view_history: true, notify_email: true,
    },
  },
  standard: {
    name: "Padrão",
    description: "Módulos principais + notificações + renovações",
    permissions: {
      manage_lockers: true, manage_employees: true, manage_departments: true,
      manage_sectors: true, view_dashboard: true, view_history: true,
      manage_renewals: true, view_audit: true, waitlist_enabled: true,
      notify_whatsapp: true, notify_email: true,
    },
  },
  premium: {
    name: "Premium",
    description: "Todos os recursos + white label + portal",
    permissions: {
      manage_lockers: true, manage_employees: true, manage_departments: true,
      manage_sectors: true, view_dashboard: true, view_history: true,
      manage_renewals: true, view_audit: true, waitlist_enabled: true,
      hygienization_enabled: true, google_login: true, portal_access: true,
      notify_whatsapp: true, notify_email: true, white_label: true,
    },
  },
};

// ─── Interfaces ───────────────────────────────────────
interface PermissionGroup {
  id: string;
  name: string;
  description: string;
  permissions: Record<string, boolean>;
  is_default: boolean;
}

interface Props {
  company: any;
  open: boolean;
  onClose: () => void;
}

export default function GerenciarPermissoes({ company, open, onClose }: Props) {
  const { toast } = useToast();
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customGroups, setCustomGroups] = useState<PermissionGroup[]>([]);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [activeTab, setActiveTab] = useState("modulos");

  // Load current permissions
  useEffect(() => {
    if (!company || !open) return;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("company_permissions")
        .select("permission, enabled")
        .eq("company_id", company.id);

      const perms: Record<string, boolean> = {};
      ALL_PERMISSIONS.forEach(p => { perms[p.key] = false; });
      if (data) {
        data.forEach((row: any) => { perms[row.permission] = row.enabled; });
      }
      setPermissions(perms);
      setLoading(false);
    };
    load();
  }, [company, open]);

  // Load custom groups
  useEffect(() => {
    if (!open) return;
    const loadGroups = async () => {
      const { data } = await supabase
        .from("permission_groups")
        .select("*")
        .order("name");
      if (data) setCustomGroups(data as any[]);
    };
    loadGroups();
  }, [open]);

  const togglePermission = async (permKey: string, enabled: boolean) => {
    setPermissions(prev => ({ ...prev, [permKey]: enabled }));

    const { error } = await supabase
      .from("company_permissions")
      .upsert(
        { company_id: company.id, permission: permKey, enabled } as any,
        { onConflict: "company_id,permission" }
      );

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      setPermissions(prev => ({ ...prev, [permKey]: !enabled }));
    }
  };

  const applyPreset = async (presetPerms: Record<string, boolean>) => {
    setSaving(true);
    const newPerms: Record<string, boolean> = {};
    ALL_PERMISSIONS.forEach(p => { newPerms[p.key] = presetPerms[p.key] || false; });

    let errors = 0;
    for (const [key, enabled] of Object.entries(newPerms)) {
      const { error } = await supabase
        .from("company_permissions")
        .upsert(
          { company_id: company.id, permission: key, enabled } as any,
          { onConflict: "company_id,permission" }
        );
      if (error) errors++;
    }

    setPermissions(newPerms);
    setSaving(false);

    if (errors > 0) {
      toast({ title: "Erro", description: "Algumas permissões não foram salvas.", variant: "destructive" });
    } else {
      toast({ title: "Grupo aplicado!", description: "Permissões atualizadas com sucesso." });
    }
  };

  const saveAsGroup = async () => {
    if (!newGroupName.trim()) return;
    setSaving(true);

    const activePerms: Record<string, boolean> = {};
    Object.entries(permissions).forEach(([key, val]) => {
      if (val) activePerms[key] = true;
    });

    const { data, error } = await supabase
      .from("permission_groups")
      .insert({
        name: newGroupName.trim(),
        description: newGroupDesc.trim(),
        permissions: activePerms,
      } as any)
      .select()
      .single();

    if (error) {
      toast({ title: "Erro ao salvar grupo", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Grupo criado!", description: `"${newGroupName}" salvo com sucesso.` });
      setCustomGroups(prev => [...prev, data as any]);
      setGroupDialogOpen(false);
      setNewGroupName("");
      setNewGroupDesc("");
    }
    setSaving(false);
  };

  const deleteGroup = async (groupId: string) => {
    const { error } = await supabase.from("permission_groups").delete().eq("id", groupId);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      setCustomGroups(prev => prev.filter(g => g.id !== groupId));
      toast({ title: "Grupo excluído" });
    }
  };

  const enabledCount = Object.values(permissions).filter(Boolean).length;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-xl w-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Permissões — {company?.name}
          </SheetTitle>
          <SheetDescription>
            Gerencie quais módulos e funcionalidades estão disponíveis para esta empresa.
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            {/* Summary + Actions */}
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-xs gap-1.5">
                <Shield className="h-3 w-3" />
                {enabledCount}/{ALL_PERMISSIONS.length} ativas
              </Badge>
              <div className="flex gap-2">
                {/* Apply Preset Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs rounded-xl" disabled={saving}>
                      <FolderOpen className="h-3.5 w-3.5" />
                      Aplicar Grupo
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64 rounded-xl">
                    <div className="px-2 py-1.5">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Predefinidos</p>
                    </div>
                    {Object.entries(BUILTIN_PRESETS).map(([key, preset]) => (
                      <DropdownMenuItem
                        key={key}
                        onClick={() => applyPreset(preset.permissions)}
                        className="flex flex-col items-start py-2 rounded-lg"
                      >
                        <span className="text-sm font-medium">{preset.name}</span>
                        <span className="text-[10px] text-muted-foreground">{preset.description}</span>
                      </DropdownMenuItem>
                    ))}
                    {customGroups.length > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <div className="px-2 py-1.5">
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Personalizados</p>
                        </div>
                        {customGroups.map((group) => (
                          <div key={group.id} className="flex items-center justify-between px-2 py-1 group">
                            <DropdownMenuItem
                              onClick={() => applyPreset(group.permissions)}
                              className="flex-1 flex flex-col items-start py-2 rounded-lg"
                            >
                              <span className="text-sm font-medium">{group.name}</span>
                              {group.description && (
                                <span className="text-[10px] text-muted-foreground">{group.description}</span>
                              )}
                            </DropdownMenuItem>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteGroup(group.id); }}
                              className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Save as Group */}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs rounded-xl"
                  onClick={() => setGroupDialogOpen(true)}
                >
                  <Save className="h-3.5 w-3.5" />
                  Salvar como Grupo
                </Button>
              </div>
            </div>

            {/* Permission Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4 h-auto">
                {PERMISSION_CATEGORIES.map(cat => (
                  <TabsTrigger key={cat.key} value={cat.key} className="text-[11px] gap-1 py-2">
                    <cat.icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{cat.label}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {PERMISSION_CATEGORIES.map(cat => (
                <TabsContent key={cat.key} value={cat.key} className="mt-4 space-y-2">
                  <p className="text-xs text-muted-foreground mb-3">{cat.description}</p>
                  {ALL_PERMISSIONS.filter(p => p.category === cat.key).map(perm => (
                    <div
                      key={perm.key}
                      className="flex items-center justify-between rounded-xl border border-border/50 p-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 mr-4">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          permissions[perm.key] ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                        }`}>
                          <perm.icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{perm.label}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{perm.description}</p>
                        </div>
                      </div>
                      <Switch
                        checked={permissions[perm.key] || false}
                        onCheckedChange={(checked) => togglePermission(perm.key, checked)}
                      />
                    </div>
                  ))}
                </TabsContent>
              ))}
            </Tabs>
          </div>
        )}

        {/* Save as Group Dialog */}
        <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Copy className="h-5 w-5 text-primary" />
                Salvar como Grupo de Permissões
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Salve a configuração atual ({enabledCount} permissões ativas) como um grupo reutilizável para aplicar em outras empresas.
              </p>
              <div className="space-y-2">
                <Label>Nome do Grupo</Label>
                <Input
                  placeholder="Ex: Plano Intermediário"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição (opcional)</Label>
                <Textarea
                  placeholder="Descreva quais recursos este grupo inclui..."
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="rounded-xl border border-border/50 p-3 bg-muted/30">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Permissões incluídas</p>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_PERMISSIONS.filter(p => permissions[p.key]).map(p => (
                    <Badge key={p.key} variant="secondary" className="text-[10px] gap-1">
                      <p.icon className="h-2.5 w-2.5" />
                      {p.label}
                    </Badge>
                  ))}
                  {enabledCount === 0 && (
                    <p className="text-xs text-muted-foreground">Nenhuma permissão ativa</p>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" className="rounded-xl">Cancelar</Button>
              </DialogClose>
              <Button
                onClick={saveAsGroup}
                disabled={saving || !newGroupName.trim()}
                className="gradient-primary border-0 rounded-xl hover:opacity-90 gap-1.5"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Salvar Grupo
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}
