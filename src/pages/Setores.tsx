import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Layers, Plus, Pencil, Trash2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/ContextoEmpresa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Setor | null>(null);
  const [deleteItem, setDeleteItem] = useState<Setor | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [departamentoId, setDepartamentoId] = useState<string>("");

  const isAdmin = userRole === "admin" || userRole === "superadmin";

  const fetchData = async () => {
    if (!selectedCompany) { setSetores([]); setLoading(false); return; }
    setLoading(true);
    const [setoresRes, depsRes] = await Promise.all([
      supabase.from("setores").select("*").eq("company_id", selectedCompany.id).eq("ativo", true).order("nome"),
      supabase.from("departamentos").select("id, nome").eq("company_id", selectedCompany.id).eq("ativo", true).order("nome"),
    ]);
    setSetores(setoresRes.data || []);
    setDepartamentos(depsRes.data || []);
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
    toast({ title: "Setor removido!" });
    setDeleteItem(null);
    await fetchData();
  };

  const getDepartamentoNome = (id: string | null) => departamentos.find((d) => d.id === id)?.nome || "—";
  const filtered = setores.filter((s) => s.nome.toLowerCase().includes(search.toLowerCase()));

  if (!selectedCompany) {
    return <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Selecione uma empresa para gerenciar setores.</p></div>;
  }

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
          {isAdmin && (
            <Button size="sm" className="gap-1.5 sm:gap-2 gradient-primary border-0 text-primary-foreground hover:opacity-90 rounded-xl shadow-md shadow-primary/20 text-xs sm:text-sm"
              onClick={() => { resetForm(); setDialogOpen(true); }}>
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Novo Setor</span><span className="sm:hidden">Novo</span>
            </Button>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar setores..." className="pl-9 h-9 w-full bg-muted/50 border-transparent" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </motion.div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4"><Layers className="h-7 w-7 text-muted-foreground/50" /></div>
          <p className="text-muted-foreground font-medium">Nenhum setor encontrado.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((setor, i) => (
            <motion.div key={setor.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="shadow-card border-border/50 hover:shadow-elevated transition-shadow group">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center">
                        <Layers className="h-4 w-4 text-accent" />
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground text-sm">{setor.nome}</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Dept: {getDepartamentoNome(setor.departamento_id)}</p>
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(setor)}><Pencil className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteItem(setor)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

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
    </div>
  );
}
