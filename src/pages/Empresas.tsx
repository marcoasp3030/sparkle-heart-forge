import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Building2, Plus, Pencil, Trash2, Users, Key, Settings2, UserPlus, Eye, EyeOff, Layers, Network, Lock, Search, Filter, RotateCcw, Mail, Phone, MapPin, FileText, User } from "lucide-react";
import { supabase } from "@/lib/supabase-compat";
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
  { key: "white_label", label: "White Label", description: "Permitir personalização de logotipos, cores e textos exclusivos da empresa" },
  { key: "google_login", label: "Login com Google", description: "Permitir que os usuários da empresa façam login usando conta Google" },
];

export default function CompaniesPage() {
  const { companies: activeCompanies, refreshCompanies, isSuperAdmin } = useCompany();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCompany, setEditCompany] = useState<any>(null);
  const [deleteCompany, setDeleteCompany] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // All companies (including inactive)
  const [allCompanies, setAllCompanies] = useState<any[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "employee" | "rental">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");

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

  // Company stats
  const [companyStats, setCompanyStats] = useState<Record<string, { users: number; departments: number; sectors: number; lockers: number }>>({});

  // Form fields
  const [name, setName] = useState("");
  const [type, setType] = useState<"employee" | "rental">("employee");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [contactName, setContactName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");

  // Fetch all companies including inactive
  const fetchAllCompanies = async () => {
    const { data } = await supabase.from("companies").select("*").order("name");
    if (data) setAllCompanies(data);
  };

  useEffect(() => {
    if (isSuperAdmin) fetchAllCompanies();
  }, [isSuperAdmin, activeCompanies]);

  // Derived: companies to display based on filters
  const companies = allCompanies.length > 0 ? allCompanies : activeCompanies;

  const filteredCompanies = companies.filter((c) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || 
      c.name.toLowerCase().includes(q) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.cnpj && c.cnpj.toLowerCase().includes(q));
    const matchesType = filterType === "all" || c.type === filterType;
    const matchesStatus = filterStatus === "all" || (filterStatus === "active" ? c.active : !c.active);
    return matchesSearch && matchesType && matchesStatus;
  });

  const hasActiveFilters = searchQuery || filterType !== "all" || filterStatus !== "all";

  // Company stats
  useEffect(() => {
    const activeIds = companies.filter(c => c.active).map(c => c.id);
    if (!activeIds.length) return;
    const fetchStats = async () => {
      const [profilesRes, deptRes, setoresRes, lockersRes] = await Promise.all([
        supabase.from("profiles").select("company_id").in("company_id", activeIds),
        supabase.from("departamentos").select("company_id").in("company_id", activeIds).eq("ativo", true),
        supabase.from("setores").select("company_id").in("company_id", activeIds).eq("ativo", true),
        supabase.from("lockers").select("company_id").in("company_id", activeIds),
      ]);
      const stats: Record<string, { users: number; departments: number; sectors: number; lockers: number }> = {};
      activeIds.forEach(id => { stats[id] = { users: 0, departments: 0, sectors: 0, lockers: 0 }; });
      profilesRes.data?.forEach((r: any) => { if (r.company_id && stats[r.company_id]) stats[r.company_id].users++; });
      deptRes.data?.forEach((r: any) => { if (r.company_id && stats[r.company_id]) stats[r.company_id].departments++; });
      setoresRes.data?.forEach((r: any) => { if (r.company_id && stats[r.company_id]) stats[r.company_id].sectors++; });
      lockersRes.data?.forEach((r: any) => { if (r.company_id && stats[r.company_id]) stats[r.company_id].lockers++; });
      setCompanyStats(stats);
    };
    fetchStats();
  }, [companies]);

  const resetForm = () => {
    setName(""); setType("employee"); setDescription("");
    setEmail(""); setPhone(""); setCnpj(""); setContactName("");
    setAddress(""); setCity(""); setState("");
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
      const { data, error } = await supabase.functions.invoke("create-company-user", {
        body: {
          email: adminEmail.trim(),
          password: adminPassword,
          full_name: adminFullName.trim(),
          company_id: adminCompany.id,
          role: adminRole,
        },
      });

      if (error) {
        toast({ title: "Erro ao criar usuário", description: error.message, variant: "destructive" });
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
    setEmail(company.email || "");
    setPhone(company.phone || "");
    setCnpj(company.cnpj || "");
    setContactName(company.contact_name || "");
    setAddress(company.address || "");
    setCity(company.city || "");
    setState(company.state || "");
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
        .update({ name, type, description, email, phone, cnpj, contact_name: contactName, address, city, state })
        .eq("id", editCompany.id);
      if (error) {
        toast({ title: "Erro", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Empresa atualizada!" });
      }
    } else {
      const { data: newCompany, error } = await supabase
        .from("companies")
        .insert({ name, type, description, email, phone, cnpj, contact_name: contactName, address, city, state })
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
    await fetchAllCompanies();
    setLoading(false);
  };

  const handleReactivate = async (company: any) => {
    const { error } = await supabase.from("companies").update({ active: true }).eq("id", company.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Empresa reativada!", description: `${company.name} foi reativada.` });
    }
    await refreshCompanies();
    await fetchAllCompanies();
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
          <DialogContent className="sm:max-w-lg rounded-2xl">
            <DialogHeader>
              <DialogTitle>{editCompany ? "Editar Empresa" : "Criar Nova Empresa"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>Nome da Empresa</Label>
                  <Input placeholder="Ex: Academia XYZ" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>CNPJ</Label>
                  <Input placeholder="00.000.000/0000-00" value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={type} onValueChange={(v) => setType(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Funcionários</SelectItem>
                      <SelectItem value="rental">Aluguel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input type="email" placeholder="contato@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input placeholder="(11) 99999-0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Responsável / Contato</Label>
                  <Input placeholder="Nome do responsável" value={contactName} onChange={(e) => setContactName(e.target.value)} />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Endereço</Label>
                  <Input placeholder="Rua, número, bairro" value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input placeholder="São Paulo" value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Input placeholder="SP" value={state} onChange={(e) => setState(e.target.value)} maxLength={2} />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Descrição</Label>
                  <Textarea placeholder="Descrição opcional..." value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                </div>
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total", value: companies.length },
          { label: "Ativas", value: companies.filter((c) => c.active).length },
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

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar empresa por nome..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>
        <div className="flex gap-2">
          <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
            <SelectTrigger className="w-[150px] rounded-xl">
              <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="employee">Funcionários</SelectItem>
              <SelectItem value="rental">Aluguel</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
            <SelectTrigger className="w-[140px] rounded-xl">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativas</SelectItem>
              <SelectItem value="inactive">Inativas</SelectItem>
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl" onClick={() => { setSearchQuery(""); setFilterType("all"); setFilterStatus("all"); }} title="Limpar filtros">
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {hasActiveFilters && (
        <p className="text-sm text-muted-foreground">
          {filteredCompanies.length} empresa{filteredCompanies.length !== 1 ? "s" : ""} encontrada{filteredCompanies.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* Companies Grid */}
      {filteredCompanies.length === 0 ? (
        <div className="text-center py-16">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <Building2 className="h-7 w-7 text-muted-foreground/50" />
          </div>
          <p className="text-muted-foreground font-medium">
            {hasActiveFilters ? "Nenhuma empresa encontrada com os filtros aplicados." : "Nenhuma empresa cadastrada."}
          </p>
          {!hasActiveFilters && <p className="text-sm text-muted-foreground/60 mt-1">Crie a primeira empresa para começar.</p>}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredCompanies.map((company, i) => (
            <motion.div key={company.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}>
              <Card className={`shadow-card border-border/50 hover:shadow-elevated transition-shadow group relative ${!company.active ? "opacity-50" : ""}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground">{company.name}</h3>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge variant="outline" className={`text-[10px] ${typeLabels[company.type]?.className || ""}`}>
                            {typeLabels[company.type]?.label || company.type}
                          </Badge>
                          {!company.active && (
                            <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/20">
                              Inativa
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!company.active ? (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => handleReactivate(company)} title="Reativar">
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openAdminDialog(company)} title="Criar Usuário">
                            <UserPlus className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openPermissions(company)} title="Permissões">
                            <Settings2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(company)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteCompany(company)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Company details */}
                  <div className="mt-3 space-y-1.5">
                    {company.email && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{company.email}</span>
                      </div>
                    )}
                    {company.phone && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3 flex-shrink-0" />
                        <span>{company.phone}</span>
                      </div>
                    )}
                    {company.cnpj && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <FileText className="h-3 w-3 flex-shrink-0" />
                        <span>{company.cnpj}</span>
                      </div>
                    )}
                    {company.contact_name && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <User className="h-3 w-3 flex-shrink-0" />
                        <span>{company.contact_name}</span>
                      </div>
                    )}
                    {(company.city || company.state || company.address) && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">
                          {[company.address, company.city, company.state].filter(Boolean).join(", ")}
                        </span>
                      </div>
                    )}
                    {company.description && (
                      <p className="text-xs text-muted-foreground/70 line-clamp-2 mt-1">{company.description}</p>
                    )}
                  </div>
                  {/* Dynamic counters */}
                  <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-border/40">
                    {[
                      { icon: Users, label: "Usuários", value: companyStats[company.id]?.users ?? 0 },
                      { icon: Network, label: "Deptos", value: companyStats[company.id]?.departments ?? 0 },
                      { icon: Layers, label: "Setores", value: companyStats[company.id]?.sectors ?? 0 },
                      { icon: Lock, label: "Armários", value: companyStats[company.id]?.lockers ?? 0 },
                    ].map((stat) => (
                      <div key={stat.label} className="flex flex-col items-center gap-1">
                        <stat.icon className="h-3.5 w-3.5 text-muted-foreground/60" />
                        <span className="text-sm font-bold text-foreground">{stat.value}</span>
                        <span className="text-[10px] text-muted-foreground/60">{stat.label}</span>
                      </div>
                    ))}
                  </div>
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

      {/* Create Admin Dialog */}
      <Dialog open={adminDialogOpen} onOpenChange={setAdminDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Criar Usuário — {adminCompany?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome Completo</Label>
              <Input placeholder="Nome do usuário" value={adminFullName} onChange={(e) => setAdminFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" placeholder="usuario@empresa.com" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <div className="relative">
                <Input
                  type={showAdminPassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowAdminPassword(!showAdminPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Perfil de Acesso</Label>
              <Select value={adminRole} onValueChange={(v) => setAdminRole(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador — gerencia a empresa</SelectItem>
                  <SelectItem value="user">Usuário — acesso básico</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="rounded-xl">Cancelar</Button>
            </DialogClose>
            <Button
              onClick={handleCreateAdmin}
              disabled={adminLoading || !adminEmail.trim() || adminPassword.length < 6}
              className="gradient-primary border-0 rounded-xl hover:opacity-90"
            >
              {adminLoading ? "Criando..." : "Criar Usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
