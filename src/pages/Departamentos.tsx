import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Building, Plus, Pencil, Trash2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/ContextoEmpresa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

interface Departamento {
  id: string;
  company_id: string;
  nome: string;
  descricao: string;
  ativo: boolean;
  created_at: string;
}

export default function DepartamentosPage() {
  const { selectedCompany, isSuperAdmin, userRole } = useCompany();
  const { toast } = useToast();
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Departamento | null>(null);
  const [deleteItem, setDeleteItem] = useState<Departamento | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");

  const isAdmin = userRole === "admin" || userRole === "superadmin";

  const fetchData = async () => {
    if (!selectedCompany) { setDepartamentos([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("departamentos")
      .select("*")
      .eq("company_id", selectedCompany.id)
      .eq("ativo", true)
      .order("nome");
    setDepartamentos(data || []);
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
    toast({ title: "Departamento removido!" });
    setDeleteItem(null);
    await fetchData();
    setActionLoading(false);
  };

  const filtered = departamentos.filter((d) => d.nome.toLowerCase().includes(search.toLowerCase()));

  if (!selectedCompany) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Selecione uma empresa para gerenciar departamentos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Building className="h-5 w-5 text-primary" /></div>
            Departamentos
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Gerencie os departamentos de {selectedCompany.name}.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." className="pl-9 h-9 w-56 bg-muted/50 border-transparent" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {isAdmin && (
            <Button size="sm" className="gap-2 gradient-primary border-0 text-primary-foreground hover:opacity-90 rounded-xl shadow-md shadow-primary/20"
              onClick={() => { resetForm(); setDialogOpen(true); }}>
              <Plus className="h-4 w-4" /> Novo Departamento
            </Button>
          )}
        </div>
      </motion.div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4"><Building className="h-7 w-7 text-muted-foreground/50" /></div>
          <p className="text-muted-foreground font-medium">Nenhum departamento encontrado.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((dep, i) => (
            <motion.div key={dep.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="shadow-card border-border/50 hover:shadow-elevated transition-shadow group">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-secondary/10 flex items-center justify-center">
                        <Building className="h-4 w-4 text-secondary" />
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground text-sm">{dep.nome}</h3>
                        {dep.descricao && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{dep.descricao}</p>}
                      </div>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(dep)}><Pencil className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteItem(dep)}><Trash2 className="h-3 w-3" /></Button>
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
    </div>
  );
}
