import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Lock, Unlock, Wrench, Package, Search, Trash2, LayoutGrid, List, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/ContextoAutenticacao";
import { useCompany } from "@/contexts/ContextoEmpresa";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import UnidadeArmario, { LockerData } from "@/components/armario/UnidadeArmario";
import { LockerDoorData } from "@/components/armario/PortaArmario";
import DetalhePortaPainel from "@/components/armario/DetalhePortaPainel";

interface LockerWithDoors extends LockerData {
  doors: LockerDoorData[];
}

export default function LockersPage() {
  const { user } = useAuth();
  const { selectedCompany, isSuperAdmin, userRole } = useCompany();
  const { toast } = useToast();
  const [lockers, setLockers] = useState<LockerWithDoors[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedDoor, setSelectedDoor] = useState<LockerDoorData | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // New locker form
  const [newName, setNewName] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newOrientation, setNewOrientation] = useState<"vertical" | "horizontal">("vertical");
  const [newCols, setNewCols] = useState(2);
  const [newRows, setNewRows] = useState(4);
  const [newDoorSize, setNewDoorSize] = useState<"small" | "medium" | "large">("medium");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editLocker, setEditLocker] = useState<LockerData | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [deleteLocker, setDeleteLocker] = useState<LockerData | null>(null);

  const fetchLockers = useCallback(async () => {
    setLoading(true);
    let lockersQuery = supabase.from("lockers").select("*").order("created_at");
    if (selectedCompany) {
      lockersQuery = lockersQuery.eq("company_id", selectedCompany.id);
    }
    const { data: lockersData } = await lockersQuery;
    const { data: doorsData } = await supabase.from("locker_doors").select("*");

    if (lockersData && doorsData) {
      const merged: LockerWithDoors[] = lockersData.map((l: any) => ({
        ...l,
        doors: doorsData.filter((d: any) => d.locker_id === l.id),
      }));
      setLockers(merged);
    }
    setLoading(false);
  }, [selectedCompany]);

  useEffect(() => {
    fetchLockers();
    if (user) {
      supabase.from("profiles").select("role").eq("user_id", user.id).single()
        .then(({ data }) => {
          if (data?.role === "admin" || data?.role === "superadmin") setIsAdmin(true);
        });
    }
  }, [user, fetchLockers, selectedCompany]);

  const handleCreateLocker = async () => {
    if (!newName.trim()) return;
    setActionLoading(true);

    const { data: locker, error } = await supabase
      .from("lockers")
      .insert({ name: newName, location: newLocation, orientation: newOrientation, columns: newCols, rows: newRows, company_id: selectedCompany?.id || null })
      .select()
      .single();

    if (error || !locker) {
      toast({ title: "Erro ao criar armário", description: error?.message, variant: "destructive" });
      setActionLoading(false);
      return;
    }

    const totalDoors = newCols * newRows;
    const doors = Array.from({ length: totalDoors }, (_, i) => ({
      locker_id: locker.id,
      door_number: i + 1,
      size: newDoorSize,
      status: "available" as const,
    }));

    const { error: doorsError } = await supabase.from("locker_doors").insert(doors);
    if (doorsError) {
      toast({ title: "Erro ao criar portas", description: doorsError.message, variant: "destructive" });
    } else {
      toast({ title: "Armário criado!", description: `${newName} com ${totalDoors} portas.` });
      setCreateDialogOpen(false);
      setNewName("");
      setNewLocation("");
      fetchLockers();
    }
    setActionLoading(false);
  };

  const handleReserve = async (door: LockerDoorData) => {
    if (!user) return;
    setActionLoading(true);
    const { error } = await supabase
      .from("locker_doors")
      .update({ status: "occupied", occupied_by: user.id, occupied_at: new Date().toISOString() })
      .eq("id", door.id);

    if (error) {
      toast({ title: "Erro ao reservar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Reservado!", description: `Porta ${door.label || '#' + door.door_number} reservada com sucesso.` });
      setSheetOpen(false);
      fetchLockers();
    }
    setActionLoading(false);
  };

  const handleRelease = async (door: LockerDoorData) => {
    setActionLoading(true);
    const { error } = await supabase
      .from("locker_doors")
      .update({ status: "available", occupied_by: null, occupied_at: null })
      .eq("id", door.id);

    if (error) {
      toast({ title: "Erro ao liberar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Liberado!", description: `Porta ${door.label || '#' + door.door_number} liberada.` });
      setSheetOpen(false);
      fetchLockers();
    }
    setActionLoading(false);
  };

  const openEditDialog = (locker: LockerData) => {
    setEditLocker(locker);
    setEditName(locker.name);
    setEditLocation(locker.location);
    setEditDialogOpen(true);
  };

  const handleEditLocker = async () => {
    if (!editLocker || !editName.trim()) return;
    setActionLoading(true);
    const { error } = await supabase
      .from("lockers")
      .update({ name: editName, location: editLocation })
      .eq("id", editLocker.id);

    if (error) {
      toast({ title: "Erro ao editar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Atualizado!", description: `${editName} atualizado com sucesso.` });
      setEditDialogOpen(false);
      fetchLockers();
    }
    setActionLoading(false);
  };

  const handleDeleteLocker = async () => {
    if (!deleteLocker) return;
    setActionLoading(true);
    const { error } = await supabase.from("lockers").delete().eq("id", deleteLocker.id);

    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Excluído!", description: `${deleteLocker.name} removido.` });
      setDeleteLocker(null);
      fetchLockers();
    }
    setActionLoading(false);
  };

  const filteredLockers = lockers.filter(
    (l) =>
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.location.toLowerCase().includes(search.toLowerCase())
  );

  // Stats
  const allDoors = lockers.flatMap((l) => l.doors);
  const stats = [
    { label: "Total de Portas", value: allDoors.length, icon: Package, accent: "" },
    { label: "Disponíveis", value: allDoors.filter((d) => d.status === "available").length, icon: Unlock, accent: "success" },
    { label: "Ocupados", value: allDoors.filter((d) => d.status === "occupied").length, icon: Lock, accent: "primary" },
    { label: "Manutenção", value: allDoors.filter((d) => d.status === "maintenance").length, icon: Wrench, accent: "accent" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Armários</h1>
          <p className="text-sm text-muted-foreground mt-1">Visualize e gerencie os armários inteligentes.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." className="pl-9 h-9 w-56 bg-muted/50 border-transparent" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {isAdmin && (
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2 gradient-primary border-0 text-primary-foreground hover:opacity-90 rounded-xl shadow-md shadow-primary/20">
                  <Plus className="h-4 w-4" />
                  Novo Armário
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md rounded-2xl">
                <DialogHeader>
                  <DialogTitle>Criar Novo Armário</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input placeholder="Ex: Armário A" value={newName} onChange={(e) => setNewName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Localização</Label>
                    <Input placeholder="Ex: Lobby Principal" value={newLocation} onChange={(e) => setNewLocation(e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Orientação</Label>
                      <Select value={newOrientation} onValueChange={(v) => setNewOrientation(v as any)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vertical">Vertical</SelectItem>
                          <SelectItem value="horizontal">Horizontal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Tamanho das Portas</Label>
                      <Select value={newDoorSize} onValueChange={(v) => setNewDoorSize(v as any)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="small">Pequeno</SelectItem>
                          <SelectItem value="medium">Médio</SelectItem>
                          <SelectItem value="large">Grande</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Colunas</Label>
                      <Input type="number" min={1} max={10} value={newCols} onChange={(e) => setNewCols(Number(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Linhas</Label>
                      <Input type="number" min={1} max={10} value={newRows} onChange={(e) => setNewRows(Number(e.target.value))} />
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="p-4 rounded-xl bg-muted/30 border border-border/40">
                    <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mb-3">Prévia</p>
                    <div
                      className="grid gap-1.5"
                      style={{ gridTemplateColumns: `repeat(${newOrientation === "horizontal" ? newRows : newCols}, minmax(0, 1fr))` }}
                    >
                      {Array.from({ length: newCols * newRows }).map((_, i) => (
                        <div
                          key={i}
                          className={`rounded-lg border-2 border-dashed border-success/30 bg-success/5 flex items-center justify-center ${
                            newDoorSize === "small" ? "h-8" : newDoorSize === "medium" ? "h-12" : "h-16"
                          }`}
                        >
                          <span className="text-[9px] font-mono text-muted-foreground">{i + 1}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline" className="rounded-xl">Cancelar</Button>
                  </DialogClose>
                  <Button onClick={handleCreateLocker} disabled={actionLoading || !newName.trim()} className="gradient-primary border-0 rounded-xl hover:opacity-90">
                    {actionLoading ? "Criando..." : "Criar Armário"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <Card className="shadow-card hover:shadow-elevated transition-shadow border-border/50">
              <CardContent className="p-5">
                <div className={`rounded-lg p-2 w-fit mb-3 ${
                  stat.accent === "success" ? "bg-success/10" :
                  stat.accent === "primary" ? "bg-primary/10" :
                  stat.accent === "accent" ? "bg-accent/10" : "bg-muted"
                }`}>
                  <stat.icon className={`h-4 w-4 ${
                    stat.accent === "success" ? "text-success" :
                    stat.accent === "primary" ? "text-primary" :
                    stat.accent === "accent" ? "text-accent" : "text-muted-foreground"
                  }`} />
                </div>
                <p className="text-3xl font-extrabold text-foreground tracking-tight">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{stat.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Lockers Grid */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : filteredLockers.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <Package className="h-7 w-7 text-muted-foreground/50" />
          </div>
          <p className="text-muted-foreground font-medium">Nenhum armário encontrado.</p>
          <p className="text-sm text-muted-foreground/60 mt-1">
            {isAdmin ? "Crie um novo armário para começar." : "Aguarde um administrador cadastrar armários."}
          </p>
        </motion.div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredLockers.map((locker, i) => (
            <UnidadeArmario
              key={locker.id}
              locker={locker}
              doors={locker.doors}
              index={i}
              currentUserId={user?.id}
              isAdmin={isAdmin}
              onEdit={openEditDialog}
              onDelete={(l) => setDeleteLocker(l)}
              onSelectDoor={(door) => {
                setSelectedDoor(door);
                setSheetOpen(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Door detail sheet */}
      <DetalhePortaPainel
        door={selectedDoor}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onReserve={handleReserve}
        onRelease={handleRelease}
        isCurrentUser={selectedDoor?.occupied_by === user?.id}
        loading={actionLoading}
      />

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Editar Armário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Localização</Label>
              <Input value={editLocation} onChange={(e) => setEditLocation(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="rounded-xl">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleEditLocker} disabled={actionLoading || !editName.trim()} className="gradient-primary border-0 rounded-xl hover:opacity-90">
              {actionLoading ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteLocker} onOpenChange={(open) => !open && setDeleteLocker(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir armário?</AlertDialogTitle>
            <AlertDialogDescription>
              O armário <strong>{deleteLocker?.name}</strong> e todas as suas portas serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteLocker} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl">
              {actionLoading ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
