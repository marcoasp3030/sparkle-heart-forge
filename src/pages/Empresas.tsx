import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Building2, Plus, Pencil, Trash2, Users, Key, Settings2, UserPlus, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/ContextoEmpresa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";

const typeLabels: Record<string, { label: string; className: string }> = {
  employee: { label: "Funcionários", className: "bg-secondary/10 text-secondary border-secondary/20" },
  rental: { label: "Aluguel", className: "bg-accent/10 text-accent border-accent/20" },
};

const AVAILABLE_PERMISSIONS = [
  { key: "manage_employees", label: "Gerenciar Funcionários/Clientes", description: "Cadastrar, editar e remover funcionários e clientes" },
  { key: "manage_lockers", label: "Gerenciar Armários", description: "Reservar e administrar portas de armários" },
];

export default function CompaniesPage() {
  const { companies, refreshCompanies, isSuperAdmin } = useCompany();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCompany, setEditCompany] = useState<any>(null);
  const [deleteCompany, setDeleteCompany] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Permissions sheet
  const [permCompany, setPermCompany] = useState<any>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [permLoading, setPermLoading] = useState(false);

  // Create admin dialog
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const [adminCompany, setAdminCompany] = useState<any>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminFullName, setAdminFullName] = useState("");
  const [adminRole, setAdminRole] = useState<"admin" | "user">("admin");
  const [adminLoading, setAdminLoading] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [type, setType] = useState<"employee" | "rental">("employee");
  const [description, setDescription] = useState("");

  const resetForm = () => {
    setName("");
    setType("employee");
    setDescription("");
    setEditCompany(null);
  };

  const openAdminDialog = (company: any) => {
    setAdminCompany(company);
    setAdminEmail("");
    setAdminPassword("");
    setAdminFullName("");
    setAdminRole("admin");
    setShowAdminPassword(false);
    setAdminDialogOpen(true);
  };

  const handleCreateAdmin = async () => {
    if (!adminEmail.trim() || !adminPassword || !adminCompany) return;
    setAdminLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-company-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            email: adminEmail.trim(),
            password: adminPassword,
            full_name: adminFullName.trim(),
            company_id: adminCompany.id,
            role: adminRole,
          }),
        }
      );

      const result = await res.json();
      if (!res.ok) {
        toast({ title: "Erro ao criar usuário", description: result.error, variant: "destructive" });
      } else {
        toast({ title: "Usuário criado!", description: `${adminEmail} vinculado à ${adminCompany.name}` });
        setAdminDialogOpen(false);
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setAdminLoading(false);
    }
  };

  const openEdit = (company: any) => {
    setEditCompany(company);
    setName(company.name);
    setType(company.type);
    setDescription(company.description || "");
    setDialogOpen(true);
  };

  const openPermissions = async (company: any) => {
    setPermCompany(company);
    setPermLoading(true);
    const { data } = await supabase
      .from("company_permissions")
      .select("permission, enabled")
      .eq("company_id", company.id);

    const perms: Record<string, boolean> = {};
    AVAILABLE_PERMISSIONS.forEach((p) => { perms[p.key] = false; });
    if (data) {
      data.forEach((row: any) => { perms[row.permission] = row.enabled; });
    }
    setPermissions(perms);
    setPermLoading(false);
  };

  const togglePermission = async (permKey: string, enabled: boolean) => {
    if (!permCompany) return;
    setPermissions((prev) => ({ ...prev, [permKey]: enabled }));

    const { error } = await supabase
      .from("company_permissions")
      .upsert(
        { company_id: permCompany.id, permission: permKey, enabled },
        { onConflict: "company_id,permission" }
      );

    if (error) {
      toast({ title: "Erro ao salvar permissão", description: error.message, variant: "destructive" });
      setPermissions((prev) => ({ ...prev, [permKey]: !enabled }));
    } else {
      toast({ title: "Permissão atualizada!", description: `${enabled ? "Ativada" : "Desativada"} para ${permCompany.name}` });
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setLoading(true);

    if (editCompany) {
      const { error } = await supabase
        .from("companies")
        .update({ name, type, description })
        .eq("id", editCompany.id);
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Empresa atualizada!" });
      }
    } else {
      const { data: newCompany, error } = await supabase
        .from("companies")
        .insert({ name, type, description })
        .select()
        .single();
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      } else {
        // Auto-create default permissions for new company
        if (newCompany) {
          await supabase.from("company_permissions").insert([
            { company_id: newCompany.id, permission: "manage_employees", enabled: true },
            { company_id: newCompany.id, permission: "manage_lockers", enabled: true },
          ]);
        }
        toast({ title: "Empresa criada!", description: `${name} adicionada com sucesso.` });
      }
    }

    setDialogOpen(false);
    resetForm();
    await refreshCompanies();
    setLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteCompany) return;
    setLoading(true);
    const { error } = await supabase.from("companies").update({ active: false }).eq("id", deleteCompany.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Empresa desativada!", description: `${deleteCompany.name} foi desativada.` });
    }
    setDeleteCompany(null);
    await refreshCompanies();
    setLoading(false);
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Acesso restrito ao superadministrador.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            Empresas
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Gerencie as empresas e suas permissões.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2 gradient-primary border-0 text-primary-foreground hover:opacity-90 rounded-xl shadow-md shadow-primary/20">
              <Plus className="h-4 w-4" />
              Nova Empresa
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle>{editCompany ? "Editar Empresa" : "Criar Nova Empresa"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome da Empresa</Label>
                <Input placeholder="Ex: Academia XYZ" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={type} onValueChange={(v) => setType(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Funcionários — armários para colaboradores</SelectItem>
                    <SelectItem value="rental">Aluguel — armários para clientes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea placeholder="Descrição opcional..." value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" className="rounded-xl">Cancelar</Button>
              </DialogClose>
              <Button onClick={handleSave} disabled={loading || !name.trim()} className="gradient-primary border-0 rounded-xl hover:opacity-90">
                {loading ? "Salvando..." : editCompany ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total", value: companies.length },
          { label: "Funcionários", value: companies.filter((c) => c.type === "employee").length },
          { label: "Aluguel", value: companies.filter((c) => c.type === "rental").length },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card className="shadow-card border-border/50">
              <CardContent className="p-5">
                <p className="text-3xl font-extrabold text-foreground tracking-tight">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{stat.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Companies Grid */}
      {companies.length === 0 ? (
        <div className="text-center py-16">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <Building2 className="h-7 w-7 text-muted-foreground/50" />
          </div>
          <p className="text-muted-foreground font-medium">Nenhuma empresa cadastrada.</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Crie a primeira empresa para começar.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {companies.map((company, i) => (
            <motion.div key={company.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}>
              <Card className="shadow-card border-border/50 hover:shadow-elevated transition-shadow group relative">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground">{company.name}</h3>
                        <Badge variant="outline" className={`text-[10px] mt-1 ${typeLabels[company.type]?.className || ""}`}>
                          {typeLabels[company.type]?.label || company.type}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openPermissions(company)} title="Permissões">
                        <Settings2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(company)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteCompany(company)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {company.description && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{company.description}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground/60 mt-3">
                    Criada em {new Date(company.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Permissions Sheet */}
      <Sheet open={!!permCompany} onOpenChange={(open) => !open && setPermCompany(null)}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-primary" />
              Permissões — {permCompany?.name}
            </SheetTitle>
            <SheetDescription>
              Ative ou desative funcionalidades para esta empresa.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {permLoading ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : (
              AVAILABLE_PERMISSIONS.map((perm) => (
                <div key={perm.key} className="flex items-center justify-between rounded-xl border border-border/50 p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex-1 mr-4">
                    <p className="text-sm font-semibold text-foreground">{perm.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{perm.description}</p>
                  </div>
                  <Switch
                    checked={permissions[perm.key] || false}
                    onCheckedChange={(checked) => togglePermission(perm.key, checked)}
                  />
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteCompany} onOpenChange={(open) => !open && setDeleteCompany(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar empresa?</AlertDialogTitle>
            <AlertDialogDescription>
              A empresa <strong>{deleteCompany?.name}</strong> será desativada. Todos os dados serão preservados mas não estarão mais acessíveis.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground rounded-xl hover:bg-destructive/90">
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
