import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Layers, Plus, Pencil, Trash2, Search, Users, Building, MoreHorizontal, LayoutGrid, List, UserCheck, UserX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/ContextoEmpresa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

interface Setor {
  id: string;
  company_id: string;
  departamento_id: string | null;
  nome: string;
  descricao: string;
  ativo: boolean;
}

interface Departamento {
  id: string;
  nome: string;
}

export default function SetoresPage() {
  const { selectedCompany, userRole } = useCompany();
  const { toast } = useToast();
  const [setores, setSetores] = useState<Setor[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [funcCounts, setFuncCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("ativos");
  const [filtroDept, setFiltroDept] = useState<string>("todos");
  const [viewMode, setViewMode] = useState<"cards" | "lista">("cards");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Setor | null>(null);
  const [deleteItem, setDeleteItem] = useState<Setor | null>(null);
  const [toggleItem, setToggleItem] = useState<Setor | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [departamentoId, setDepartamentoId] = useState<string>("");

  const isAdmin = userRole === "admin" || userRole === "superadmin";

  const fetchData = async () => {
    if (!selectedCompany) { setSetores([]); setLoading(false); return; }
    setLoading(true);
    const [setoresRes, depsRes, funcsRes] = await Promise.all([
      supabase.from("setores").select("*").eq("company_id", selectedCompany.id).order("nome"),
      supabase.from("departamentos").select("id, nome").eq("company_id", selectedCompany.id).eq("ativo", true).order("nome"),
      supabase.from("funcionarios_clientes").select("setor_id").eq("company_id", selectedCompany.id).eq("ativo", true).not("setor_id", "is", null),
    ]);
    setSetores(setoresRes.data || []);
    setDepartamentos(depsRes.data || []);
    const counts: Record<string, number> = {};
    (funcsRes.data || []).forEach((f: any) => {
      if (f.setor_id) counts[f.setor_id] = (counts[f.setor_id] || 0) + 1;
    });
    setFuncCounts(counts);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [selectedCompany]);

  const resetForm = () => { setNome(""); setDescricao(""); setDepartamentoId(""); setEditItem(null); };

  const openEdit = (item: Setor) => {
    setEditItem(item);
    setNome(item.nome);
    setDescricao(item.descricao || "");
    setDepartamentoId(item.departamento_id || "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!nome.trim() || !selectedCompany) return;
    setActionLoading(true);
    const payload = { nome, descricao, departamento_id: departamentoId || null, company_id: selectedCompany.id };
    if (editItem) {
      const { error } = await supabase.from("setores").update({ nome, descricao, departamento_id: departamentoId || null }).eq("id", editItem.id);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else toast({ title: "Setor atualizado!" });
    } else {
      const { error } = await supabase.from("setores").insert(payload);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else toast({ title: "Setor criado!" });
    }
    setDialogOpen(false);
    resetForm();
    await fetchData();
    setActionLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    await supabase.from("setores").update({ ativo: false }).eq("id", deleteItem.id);
    toast({ title: "Setor desativado!" });
    setDeleteItem(null);
    await fetchData();
  };

  const handleToggleStatus = async () => {
    if (!toggleItem) return;
    const newStatus = !toggleItem.ativo;
    const { error } = await supabase.from("setores").update({ ativo: newStatus }).eq("id", toggleItem.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else toast({ title: newStatus ? "Setor ativado!" : "Setor desativado!" });
    setToggleItem(null);
    await fetchData();
  };

  const getDeptNome = (id: string | null) => departamentos.find((d) => d.id === id)?.nome || "—";
  const getFuncCount = (id: string) => funcCounts[id] || 0;

  const totalAtivos = setores.filter(s => s.ativo).length;
  const totalInativos = setores.filter(s => !s.ativo).length;

  const filtered = setores.filter((s) => {
    const matchSearch = s.nome.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filtroStatus === "todos" || (filtroStatus === "ativos" ? s.ativo : !s.ativo);
    const matchDept = filtroDept === "todos" || s.departamento_id === filtroDept || (filtroDept === "sem" && !s.departamento_id);
    return matchSearch && matchStatus && matchDept;
  });

  if (!selectedCompany) {
    return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Selecione uma empresa para gerenciar setores.</p></div>;
  }

  const ActionsMenu = ({ setor }: { setor: Setor }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {isAdmin && (
          <>
            <DropdownMenuItem onClick={() => openEdit(setor)} className="gap-2 text-xs">
              <Pencil className="h-3.5 w-3.5" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setToggleItem(setor)} className="gap-2 text-xs">
              {setor.ativo ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
              {setor.ativo ? "Desativar" : "Ativar"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setDeleteItem(setor)} className="gap-2 text-xs text-destructive focus:text-destructive">
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
              <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10"><Layers className="h-4 w-4 sm:h-5 sm:w-5 text-primary" /></div>
              Setores
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">Gerencie os setores de {selectedCompany.name}.</p>
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
                <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Novo Setor</span><span className="sm:hidden">Novo</span>
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar setores..." className="pl-9 h-9 w-full bg-muted/50 border-transparent" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filtroDept} onValueChange={setFiltroDept}>
            <SelectTrigger className="w-36 sm:w-44 h-9 text-xs"><SelectValue placeholder="Departamento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os depts.</SelectItem>
              <SelectItem value="sem">Sem departamento</SelectItem>
              {departamentos.map(d => <SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-28 sm:w-36 h-9 text-xs"><SelectValue /></SelectTrigger>
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
          { label: "Total", value: setores.length, icon: Layers },
          { label: "Ativos", value: totalAtivos, icon: UserCheck },
          { label: "Inativos", value: totalInativos, icon: UserX },
          { label: "Pessoas nos setores", value: Object.values(funcCounts).reduce((a, b) => a + b, 0), icon: Users },
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
          <div className="mx-auto w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4"><Layers className="h-7 w-7 text-muted-foreground/50" /></div>
          <p className="text-muted-foreground font-medium">Nenhum setor encontrado.</p>
        </div>
      ) : viewMode === "cards" ? (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((setor, i) => {
            const count = getFuncCount(setor.id);
            return (
              <motion.div key={setor.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className={`shadow-card border-border/50 hover:shadow-elevated transition-shadow group ${!setor.ativo ? "opacity-60" : ""}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                          <Layers className="h-4 w-4 text-accent" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-foreground text-sm truncate">{setor.nome}</h3>
                            <Badge variant="outline" className={`text-[10px] shrink-0 ${setor.ativo ? "bg-green-500/10 text-green-600 border-green-500/20" : "bg-muted text-muted-foreground border-border"}`}>
                              {setor.ativo ? "Ativo" : "Inativo"}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Building className="h-3 w-3" /> {getDeptNome(setor.departamento_id)}
                          </p>
                          {setor.descricao && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{setor.descricao}</p>}
                        </div>
                      </div>
                      <ActionsMenu setor={setor} />
                    </div>
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="h-3.5 w-3.5" /> {count} pessoa{count !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="shadow-card border-border/50 overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs uppercase tracking-wider font-semibold">Nome</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider font-semibold">Departamento</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider font-semibold">Pessoas</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider font-semibold">Status</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider font-semibold w-12">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((setor) => (
                    <TableRow key={setor.id} className={!setor.ativo ? "opacity-60" : ""}>
                      <TableCell className="font-medium text-sm">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-md bg-accent/10 flex items-center justify-center shrink-0">
                            <Layers className="h-3.5 w-3.5 text-accent" />
                          </div>
                          <div>
                            <span>{setor.nome}</span>
                            {setor.descricao && <p className="text-[11px] text-muted-foreground line-clamp-1">{setor.descricao}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Building className="h-3 w-3" /> {getDeptNome(setor.departamento_id)}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                          <Users className="h-3 w-3 mr-1" />{getFuncCount(setor.id)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${setor.ativo ? "bg-green-500/10 text-green-600 border-green-500/20" : "bg-muted text-muted-foreground border-border"}`}>
                          {setor.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell><ActionsMenu setor={setor} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Create/Edit */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader><DialogTitle>{editItem ? "Editar Setor" : "Novo Setor"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Nome</Label><Input placeholder="Ex: Financeiro" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Departamento</Label>
              <Select value={departamentoId} onValueChange={setDepartamentoId}>
                <SelectTrigger><SelectValue placeholder="Selecionar departamento" /></SelectTrigger>
                <SelectContent>
                  {departamentos.map((d) => (<SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
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

      {/* Delete */}
      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover setor?</AlertDialogTitle>
            <AlertDialogDescription>O setor <strong>{deleteItem?.nome}</strong> será desativado.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground rounded-xl hover:bg-destructive/90">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Toggle status */}
      <AlertDialog open={!!toggleItem} onOpenChange={(open) => !open && setToggleItem(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{toggleItem?.ativo ? "Desativar" : "Ativar"} setor?</AlertDialogTitle>
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
