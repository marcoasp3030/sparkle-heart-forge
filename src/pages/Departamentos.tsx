import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building, Plus, Pencil, Trash2, Search, Users, Layers, MoreHorizontal, Eye, ChevronDown, ChevronRight, LayoutGrid, List, UserCheck, UserX } from "lucide-react";
import { supabase } from "@/lib/supabase-compat";
import { useCompany } from "@/contexts/ContextoEmpresa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

interface Departamento {
  id: string;
  company_id: string;
  nome: string;
  descricao: string;
  ativo: boolean;
  created_at: string;
}

interface Setor {
  id: string;
  nome: string;
  departamento_id: string | null;
}

interface FuncCount {
  departamento_id: string;
  count: number;
}

export default function DepartamentosPage() {
  const { selectedCompany, isSuperAdmin, userRole } = useCompany();
  const { toast } = useToast();
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [funcCounts, setFuncCounts] = useState<FuncCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("ativos");
  const [viewMode, setViewMode] = useState<"cards" | "lista">("cards");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Departamento | null>(null);
  const [deleteItem, setDeleteItem] = useState<Departamento | null>(null);
  const [toggleItem, setToggleItem] = useState<Departamento | null>(null);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");

  const isAdmin = userRole === "admin" || userRole === "superadmin";

  const fetchData = async () => {
    if (!selectedCompany) { setDepartamentos([]); setLoading(false); return; }
    setLoading(true);
    const [depsRes, setoresRes, funcsRes] = await Promise.all([
      supabase.from("departamentos").select("*").eq("company_id", selectedCompany.id).order("nome"),
      supabase.from("setores").select("id, nome, departamento_id").eq("company_id", selectedCompany.id).eq("ativo", true).order("nome"),
      supabase.from("funcionarios_clientes").select("departamento_id").eq("company_id", selectedCompany.id).eq("ativo", true).not("departamento_id", "is", null),
    ]);
    setDepartamentos(depsRes.data || []);
    setSetores((setoresRes.data || []) as Setor[]);

    // Count funcionarios per department
    const counts: Record<string, number> = {};
    (funcsRes.data || []).forEach((f: any) => {
      if (f.departamento_id) counts[f.departamento_id] = (counts[f.departamento_id] || 0) + 1;
    });
    setFuncCounts(Object.entries(counts).map(([departamento_id, count]) => ({ departamento_id, count })));
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [selectedCompany]);

  const resetForm = () => { setNome(""); setDescricao(""); setEditItem(null); };

  const openEdit = (item: Departamento) => {
    setEditItem(item);
    setNome(item.nome);
    setDescricao(item.descricao || "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!nome.trim() || !selectedCompany) return;
    setActionLoading(true);
    if (editItem) {
      const { error } = await supabase.from("departamentos").update({ nome, descricao }).eq("id", editItem.id);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else toast({ title: "Departamento atualizado!" });
    } else {
      const { error } = await supabase.from("departamentos").insert({ nome, descricao, company_id: selectedCompany.id });
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else toast({ title: "Departamento criado!" });
    }
    setDialogOpen(false);
    resetForm();
    await fetchData();
    setActionLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    setActionLoading(true);
    await supabase.from("departamentos").update({ ativo: false }).eq("id", deleteItem.id);
    toast({ title: "Departamento desativado!" });
    setDeleteItem(null);
    await fetchData();
    setActionLoading(false);
  };

  const handleToggleStatus = async () => {
    if (!toggleItem) return;
    const newStatus = !toggleItem.ativo;
    const { error } = await supabase.from("departamentos").update({ ativo: newStatus }).eq("id", toggleItem.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else toast({ title: newStatus ? "Departamento ativado!" : "Departamento desativado!" });
    setToggleItem(null);
    await fetchData();
  };

  const getSetoresByDept = (deptId: string) => setores.filter(s => s.departamento_id === deptId);
  const getFuncCount = (deptId: string) => funcCounts.find(f => f.departamento_id === deptId)?.count || 0;

  const toggleExpand = (id: string) => {
    setExpandedDepts(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const totalAtivos = departamentos.filter(d => d.ativo).length;
  const totalInativos = departamentos.filter(d => !d.ativo).length;

  const filtered = departamentos.filter((d) => {
    const matchSearch = d.nome.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filtroStatus === "todos" || (filtroStatus === "ativos" ? d.ativo : !d.ativo);
    return matchSearch && matchStatus;
  });

  if (!selectedCompany) {
    return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Selecione uma empresa para gerenciar departamentos.</p></div>;
  }

  const ActionsMenu = ({ dep }: { dep: Departamento }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {isAdmin && (
          <>
            <DropdownMenuItem onClick={() => openEdit(dep)} className="gap-2 text-xs">
              <Pencil className="h-3.5 w-3.5" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setToggleItem(dep)} className="gap-2 text-xs">
              {dep.ativo ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
              {dep.ativo ? "Desativar" : "Ativar"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setDeleteItem(dep)} className="gap-2 text-xs text-destructive focus:text-destructive">
              <Trash2 className="h-3.5 w-3.5" /> Remover
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10"><Building className="h-4 w-4 sm:h-5 sm:w-5 text-primary" /></div>
              Departamentos
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">Gerencie os departamentos de {selectedCompany.name}.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex border rounded-lg overflow-hidden">
              <Button variant={viewMode === "cards" ? "default" : "ghost"} size="icon" className="h-8 w-8 rounded-none" onClick={() => setViewMode("cards")}>
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button variant={viewMode === "lista" ? "default" : "ghost"} size="icon" className="h-8 w-8 rounded-none" onClick={() => setViewMode("lista")}>
                <List className="h-4 w-4" />
              </Button>
            </div>
            {isAdmin && (
              <Button size="sm" className="gap-1.5 sm:gap-2 gradient-primary border-0 text-primary-foreground hover:opacity-90 rounded-xl shadow-md shadow-primary/20 text-xs sm:text-sm"
                onClick={() => { resetForm(); setDialogOpen(true); }}>
                <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Novo Departamento</span><span className="sm:hidden">Novo</span>
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar departamentos..." className="pl-9 h-9 w-full bg-muted/50 border-transparent" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-32 sm:w-40 h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativos">Ativos ({totalAtivos})</SelectItem>
              <SelectItem value="inativos">Inativos ({totalInativos})</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        {[
          { label: "Total", value: departamentos.length, icon: Building },
          { label: "Ativos", value: totalAtivos, icon: UserCheck },
          { label: "Inativos", value: totalInativos, icon: UserX },
          { label: "Setores vinculados", value: setores.length, icon: Layers },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card className="shadow-card border-border/50">
              <CardContent className="p-3 sm:p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">{stat.value}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{stat.label}</p>
                  </div>
                  <stat.icon className="h-5 w-5 text-muted-foreground/40" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4"><Building className="h-7 w-7 text-muted-foreground/50" /></div>
          <p className="text-muted-foreground font-medium">Nenhum departamento encontrado.</p>
        </div>
      ) : viewMode === "cards" ? (
        /* Cards view with hierarchy */
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((dep, i) => {
            const deptSetores = getSetoresByDept(dep.id);
            const funcCount = getFuncCount(dep.id);
            const isExpanded = expandedDepts.has(dep.id);

            return (
              <motion.div key={dep.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className={`shadow-card border-border/50 hover:shadow-elevated transition-shadow group ${!dep.ativo ? "opacity-60" : ""}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="h-9 w-9 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                          <Building className="h-4 w-4 text-secondary" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-foreground text-sm truncate">{dep.nome}</h3>
                            <Badge variant="outline" className={`text-[10px] shrink-0 ${dep.ativo ? "bg-green-500/10 text-green-600 border-green-500/20" : "bg-muted text-muted-foreground border-border"}`}>
                              {dep.ativo ? "Ativo" : "Inativo"}
                            </Badge>
                          </div>
                          {dep.descricao && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{dep.descricao}</p>}
                        </div>
                      </div>
                      <ActionsMenu dep={dep} />
                    </div>

                    {/* Counters */}
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="h-3.5 w-3.5" /> {funcCount} pessoa{funcCount !== 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Layers className="h-3.5 w-3.5" /> {deptSetores.length} setor{deptSetores.length !== 1 ? "es" : ""}
                      </span>
                    </div>

                    {/* Expandable setores */}
                    {deptSetores.length > 0 && (
                      <Collapsible open={isExpanded} onOpenChange={() => toggleExpand(dep.id)}>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="w-full mt-2 gap-1.5 text-xs h-7 text-muted-foreground hover:text-foreground">
                            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            Ver setores
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-2 space-y-1">
                            {deptSetores.map(s => (
                              <div key={s.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50">
                                <Layers className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-foreground">{s.nome}</span>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* Table/list view */
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="shadow-card border-border/50 overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs uppercase tracking-wider font-semibold">Nome</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider font-semibold">Descrição</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider font-semibold">Pessoas</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider font-semibold">Setores</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider font-semibold">Status</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider font-semibold w-12">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((dep) => (
                    <TableRow key={dep.id} className={!dep.ativo ? "opacity-60" : ""}>
                      <TableCell className="font-medium text-sm">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-md bg-secondary/10 flex items-center justify-center shrink-0">
                            <Building className="h-3.5 w-3.5 text-secondary" />
                          </div>
                          {dep.nome}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{dep.descricao || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                          <Users className="h-3 w-3 mr-1" />{getFuncCount(dep.id)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] bg-secondary/5 text-secondary border-secondary/20">
                          <Layers className="h-3 w-3 mr-1" />{getSetoresByDept(dep.id).length}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${dep.ativo ? "bg-green-500/10 text-green-600 border-green-500/20" : "bg-muted text-muted-foreground border-border"}`}>
                          {dep.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell><ActionsMenu dep={dep} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader><DialogTitle>{editItem ? "Editar Departamento" : "Novo Departamento"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Nome</Label><Input placeholder="Ex: Recursos Humanos" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
            <div className="space-y-2"><Label>Descrição</Label><Textarea placeholder="Descrição opcional..." value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} /></div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" className="rounded-xl">Cancelar</Button></DialogClose>
            <Button onClick={handleSave} disabled={actionLoading || !nome.trim()} className="gradient-primary border-0 rounded-xl hover:opacity-90">
              {actionLoading ? "Salvando..." : editItem ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover departamento?</AlertDialogTitle>
            <AlertDialogDescription>O departamento <strong>{deleteItem?.nome}</strong> será desativado.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground rounded-xl hover:bg-destructive/90">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Toggle status confirm */}
      <AlertDialog open={!!toggleItem} onOpenChange={(open) => !open && setToggleItem(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{toggleItem?.ativo ? "Desativar" : "Ativar"} departamento?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{toggleItem?.nome}</strong> será {toggleItem?.ativo ? "desativado" : "reativado"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleStatus}
              className={`rounded-xl ${toggleItem?.ativo ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "gradient-primary border-0 hover:opacity-90"}`}>
              {toggleItem?.ativo ? "Desativar" : "Ativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
