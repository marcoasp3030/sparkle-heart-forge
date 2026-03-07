import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, Plus, Pencil, Trash2, Search, Mail, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/ContextoEmpresa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

interface Pessoa {
  id: string;
  company_id: string;
  departamento_id: string | null;
  setor_id: string | null;
  nome: string;
  email: string | null;
  telefone: string | null;
  cargo: string;
  tipo: "funcionario" | "cliente";
  ativo: boolean;
  created_at: string;
}

interface Ref { id: string; nome: string; }

export default function PessoasPage() {
  const { selectedCompany, userRole } = useCompany();
  const { toast } = useToast();
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [departamentos, setDepartamentos] = useState<Ref[]>([]);
  const [setores, setSetores] = useState<Ref[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Pessoa | null>(null);
  const [deleteItem, setDeleteItem] = useState<Pessoa | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cargo, setCargo] = useState("");
  const [tipo, setTipo] = useState<"funcionario" | "cliente">("funcionario");
  const [departamentoId, setDepartamentoId] = useState("");
  const [setorId, setSetorId] = useState("");

  const isAdmin = userRole === "admin" || userRole === "superadmin";
  const companyType = selectedCompany?.type;

  const fetchData = async () => {
    if (!selectedCompany) { setPessoas([]); setLoading(false); return; }
    setLoading(true);
    const [pessoasRes, depsRes, setoresRes] = await Promise.all([
      supabase.from("funcionarios_clientes").select("*").eq("company_id", selectedCompany.id).eq("ativo", true).order("nome"),
      supabase.from("departamentos").select("id, nome").eq("company_id", selectedCompany.id).eq("ativo", true).order("nome"),
      supabase.from("setores").select("id, nome").eq("company_id", selectedCompany.id).eq("ativo", true).order("nome"),
    ]);
    setPessoas((pessoasRes.data || []) as Pessoa[]);
    setDepartamentos(depsRes.data || []);
    setSetores(setoresRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [selectedCompany]);

  const resetForm = () => {
    setNome(""); setEmail(""); setTelefone(""); setCargo("");
    setTipo(companyType === "rental" ? "cliente" : "funcionario");
    setDepartamentoId(""); setSetorId(""); setEditItem(null);
  };

  const openEdit = (item: Pessoa) => {
    setEditItem(item);
    setNome(item.nome);
    setEmail(item.email || "");
    setTelefone(item.telefone || "");
    setCargo(item.cargo || "");
    setTipo(item.tipo);
    setDepartamentoId(item.departamento_id || "");
    setSetorId(item.setor_id || "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!nome.trim() || !selectedCompany) return;
    setActionLoading(true);
    const payload = {
      nome, email: email || null, telefone: telefone || null, cargo, tipo,
      departamento_id: departamentoId || null, setor_id: setorId || null,
      company_id: selectedCompany.id,
    };
    if (editItem) {
      const { company_id, ...updatePayload } = payload;
      const { error } = await supabase.from("funcionarios_clientes").update(updatePayload).eq("id", editItem.id);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else toast({ title: "Registro atualizado!" });
    } else {
      const { error } = await supabase.from("funcionarios_clientes").insert(payload);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else toast({ title: "Registro criado!" });
    }
    setDialogOpen(false);
    resetForm();
    await fetchData();
    setActionLoading(false);
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    await supabase.from("funcionarios_clientes").update({ ativo: false }).eq("id", deleteItem.id);
    toast({ title: "Registro removido!" });
    setDeleteItem(null);
    await fetchData();
  };

  const getDep = (id: string | null) => departamentos.find((d) => d.id === id)?.nome || "—";
  const getSetor = (id: string | null) => setores.find((s) => s.id === id)?.nome || "—";

  const filtered = pessoas.filter((p) => {
    const matchSearch = p.nome.toLowerCase().includes(search.toLowerCase()) ||
      (p.email?.toLowerCase().includes(search.toLowerCase()));
    const matchTipo = filtroTipo === "todos" || p.tipo === filtroTipo;
    return matchSearch && matchTipo;
  });

  const pageTitle = companyType === "rental" ? "Clientes" : companyType === "employee" ? "Funcionários" : "Pessoas";

  if (!selectedCompany) {
    return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Selecione uma empresa.</p></div>;
  }

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10"><Users className="h-4 w-4 sm:h-5 sm:w-5 text-primary" /></div>
              {pageTitle}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">Gerencie {pageTitle.toLowerCase()} de {selectedCompany.name}.</p>
          </div>
          {isAdmin && (
            <Button size="sm" className="gap-1.5 gradient-primary border-0 text-primary-foreground hover:opacity-90 rounded-xl shadow-md shadow-primary/20 text-xs sm:text-sm"
              onClick={() => { resetForm(); setDialogOpen(true); }}>
              <Plus className="h-4 w-4" /> Novo
            </Button>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." className="pl-9 h-9 w-full bg-muted/50 border-transparent" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {[
          { label: "Total", value: pessoas.length },
          { label: "Funcionários", value: pessoas.filter((p) => p.tipo === "funcionario").length },
          { label: "Clientes", value: pessoas.filter((p) => p.tipo === "cliente").length },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card className="shadow-card border-border/50">
              <CardContent className="p-3 sm:p-5">
                <p className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">{stat.value}</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">{stat.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* List */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="shadow-card border-border/50 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 sm:px-6 py-3 sm:py-4">
            <h2 className="text-sm sm:text-base font-bold text-foreground">{pageTitle}</h2>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="w-32 sm:w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="funcionario">Funcionários</SelectItem>
                <SelectItem value="cliente">Clientes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm">Nenhum registro encontrado.</div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-xs uppercase tracking-wider font-semibold">Nome</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider font-semibold">Tipo</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider font-semibold">Cargo</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider font-semibold">Departamento</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider font-semibold">Setor</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider font-semibold">Contato</TableHead>
                        {isAdmin && <TableHead className="text-xs uppercase tracking-wider font-semibold w-20">Ações</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((pessoa) => (
                        <TableRow key={pessoa.id}>
                          <TableCell className="font-medium text-sm">{pessoa.nome}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] ${pessoa.tipo === "funcionario" ? "bg-secondary/10 text-secondary border-secondary/20" : "bg-accent/10 text-accent border-accent/20"}`}>
                              {pessoa.tipo === "funcionario" ? "Funcionário" : "Cliente"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{pessoa.cargo || "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{getDep(pessoa.departamento_id)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{getSetor(pessoa.setor_id)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {pessoa.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{pessoa.email}</span>}
                              {pessoa.telefone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{pessoa.telefone}</span>}
                            </div>
                          </TableCell>
                          {isAdmin && (
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(pessoa)}><Pencil className="h-3 w-3" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteItem(pessoa)}><Trash2 className="h-3 w-3" /></Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden divide-y divide-border">
                  {filtered.map((pessoa) => (
                    <div key={pessoa.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-sm text-foreground">{pessoa.nome}</p>
                          <p className="text-xs text-muted-foreground">{pessoa.cargo || "Sem cargo"}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className={`text-[10px] ${pessoa.tipo === "funcionario" ? "bg-secondary/10 text-secondary border-secondary/20" : "bg-accent/10 text-accent border-accent/20"}`}>
                            {pessoa.tipo === "funcionario" ? "Func." : "Cliente"}
                          </Badge>
                          {isAdmin && (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(pessoa)}><Pencil className="h-3 w-3" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteItem(pessoa)}><Trash2 className="h-3 w-3" /></Button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>Dept: {getDep(pessoa.departamento_id)}</span>
                        <span>Setor: {getSetor(pessoa.setor_id)}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {pessoa.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{pessoa.email}</span>}
                        {pessoa.telefone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{pessoa.telefone}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader><DialogTitle>{editItem ? "Editar" : "Novo Registro"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Nome</Label><Input placeholder="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} /></div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="funcionario">Funcionário</SelectItem>
                    <SelectItem value="cliente">Cliente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>E-mail</Label><Input type="email" placeholder="email@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div className="space-y-2"><Label>Telefone</Label><Input placeholder="(00) 00000-0000" value={telefone} onChange={(e) => setTelefone(e.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label>Cargo</Label><Input placeholder="Ex: Analista" value={cargo} onChange={(e) => setCargo(e.target.value)} /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Departamento</Label>
                <Select value={departamentoId} onValueChange={setDepartamentoId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {departamentos.map((d) => (<SelectItem key={d.id} value={d.id}>{d.nome}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Setor</Label>
                <Select value={setorId} onValueChange={setSetorId}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {setores.map((s) => (<SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" className="rounded-xl">Cancelar</Button></DialogClose>
            <Button onClick={handleSave} disabled={actionLoading || !nome.trim()} className="gradient-primary border-0 rounded-xl hover:opacity-90">
              {actionLoading ? "Salvando..." : editItem ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover registro?</AlertDialogTitle>
            <AlertDialogDescription><strong>{deleteItem?.nome}</strong> será desativado.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground rounded-xl hover:bg-destructive/90">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
