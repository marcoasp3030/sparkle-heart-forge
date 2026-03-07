import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Lock, Unlock, Wrench, Package, Search, Trash2, LayoutGrid, List, Filter, ArrowUpDown, MapPin, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import UnidadeArmario, { LockerData } from "@/components/armario/UnidadeArmario";
import { LockerDoorData } from "@/components/armario/PortaArmario";
import DetalhePortaPainel from "@/components/armario/DetalhePortaPainel";

interface LockerWithDoors extends LockerData {
  doors: LockerDoorData[];
  created_at: string;
}

export default function LockersPage() {
  const { user } = useAuth();
  const { selectedCompany, isSuperAdmin, userRole } = useCompany();
  const { toast } = useToast();
  const [lockers, setLockers] = useState<LockerWithDoors[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 9;
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

  const handleSetMaintenance = async (door: LockerDoorData) => {
    setActionLoading(true);
    const { error } = await supabase
      .from("locker_doors")
      .update({ status: "maintenance", occupied_by: null, occupied_at: null })
      .eq("id", door.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Manutenção", description: `Porta ${door.label || '#' + door.door_number} em manutenção.` });
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

  // Unique locations for filter
  const uniqueLocations = [...new Set(lockers.map((l) => l.location).filter(Boolean))];

  // Door counts for filter badges
  const allDoors = lockers.flatMap((l) => l.doors);
  const doorCounts = {
    all: allDoors.length,
    available: allDoors.filter((d) => d.status === "available").length,
    occupied: allDoors.filter((d) => d.status === "occupied").length,
    maintenance: allDoors.filter((d) => d.status === "maintenance").length,
  };

  const filteredLockers = lockers
    .map((l) => {
      if (statusFilter === "all") return l;
      return { ...l, doors: l.doors.filter((d) => d.status === statusFilter) };
    })
    .filter((l) => {
      if (l.doors.length === 0 && statusFilter !== "all") return false;
      const matchSearch = l.name.toLowerCase().includes(search.toLowerCase()) || l.location.toLowerCase().includes(search.toLowerCase());
      const matchLocation = locationFilter === "all" || l.location === locationFilter;
      return matchSearch && matchLocation;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "name": return a.name.localeCompare(b.name);
        case "location": return a.location.localeCompare(b.location);
        case "doors": return b.doors.length - a.doors.length;
        case "occupation": {
          const occA = a.doors.length ? a.doors.filter((d) => d.status === "occupied").length / a.doors.length : 0;
          const occB = b.doors.length ? b.doors.filter((d) => d.status === "occupied").length / b.doors.length : 0;
          return occB - occA;
        }
        case "created": return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        default: return 0;
      }
    });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredLockers.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedLockers = filteredLockers.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  // Stats
  const stats = [
    { label: "Total de Portas", value: allDoors.length, icon: Package, accent: "" },
    { label: "Disponíveis", value: doorCounts.available, icon: Unlock, accent: "success" },
    { label: "Ocupados", value: doorCounts.occupied, icon: Lock, accent: "primary" },
    { label: "Manutenção", value: doorCounts.maintenance, icon: Wrench, accent: "accent" },
  ];

  return (
    <div className="space-y-5 md:space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">Armários</h1>
            <p className="text-xs md:text-sm text-muted-foreground mt-0.5">Visualize e gerencie os armários inteligentes.</p>
          </div>
          {isAdmin && (
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 gradient-primary border-0 text-primary-foreground hover:opacity-90 rounded-xl shadow-md shadow-primary/20 text-xs md:text-sm">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Novo Armário</span>
                  <span className="sm:hidden">Novo</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md rounded-2xl mx-4">
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

        {/* Search + Filters row */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar armário..." className="pl-9 h-9 w-full sm:w-52 bg-muted/50 border-transparent" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Status filter with counters */}
              <div className="flex items-center bg-muted/50 rounded-lg p-0.5 gap-0.5 overflow-x-auto flex-1 sm:flex-none">
                {[
                  { value: "all", label: "Todos", count: doorCounts.all },
                  { value: "available", label: "Livres", count: doorCounts.available },
                  { value: "occupied", label: "Ocupados", count: doorCounts.occupied },
                  { value: "maintenance", label: "Manut.", count: doorCounts.maintenance },
                ].map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setStatusFilter(f.value)}
                    className={`px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all whitespace-nowrap flex items-center gap-1.5 ${
                      statusFilter === f.value
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f.label}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      statusFilter === f.value ? "bg-primary/10 text-primary" : "bg-muted-foreground/10"
                    }`}>
                      {f.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Location filter */}
              {uniqueLocations.length > 0 && (
                <Select value={locationFilter} onValueChange={setLocationFilter}>
                  <SelectTrigger className="h-9 w-auto min-w-[140px] bg-muted/50 border-transparent text-xs">
                    <MapPin className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                    <SelectValue placeholder="Localização" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">Todas localizações</SelectItem>
                    {uniqueLocations.map((loc) => (
                      <SelectItem key={loc} value={loc} className="text-xs">{loc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Sort */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-9 px-2.5 bg-muted/50 text-xs gap-1.5">
                    <ArrowUpDown className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Ordenar</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {[
                    { value: "name", label: "Nome" },
                    { value: "location", label: "Localização" },
                    { value: "doors", label: "Nº de Portas" },
                    { value: "occupation", label: "% Ocupação" },
                    { value: "created", label: "Data de criação" },
                  ].map((s) => (
                    <DropdownMenuItem
                      key={s.value}
                      onClick={() => setSortBy(s.value)}
                      className={`text-xs ${sortBy === s.value ? "bg-primary/10 text-primary" : ""}`}
                    >
                      {s.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* View mode */}
              <div className="flex items-center bg-muted/50 rounded-lg p-0.5 gap-0.5 flex-shrink-0">
                <button onClick={() => setViewMode("grid")} className={`p-1.5 rounded-md transition-all ${viewMode === "grid" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setViewMode("list")} className={`p-1.5 rounded-md transition-all ${viewMode === "list" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  <List className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
        {stats.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <Card className="shadow-card hover:shadow-elevated transition-shadow border-border/50">
              <CardContent className="p-3 md:p-5">
                <div className={`rounded-lg p-1.5 md:p-2 w-fit mb-2 md:mb-3 ${
                  stat.accent === "success" ? "bg-success/10" :
                  stat.accent === "primary" ? "bg-primary/10" :
                  stat.accent === "accent" ? "bg-accent/10" : "bg-muted"
                }`}>
                  <stat.icon className={`h-3.5 w-3.5 md:h-4 md:w-4 ${
                    stat.accent === "success" ? "text-success" :
                    stat.accent === "primary" ? "text-primary" :
                    stat.accent === "accent" ? "text-accent" : "text-muted-foreground"
                  }`} />
                </div>
                <p className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">{stat.value}</p>
                <p className="text-xs md:text-sm text-muted-foreground mt-0.5">{stat.label}</p>
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
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
          {paginatedLockers.map((locker, i) => (
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
              onQuickReserve={handleReserve}
              onQuickRelease={handleRelease}
            />
          ))}
        </div>
      ) : (
        /* Detailed List/Table View */
        <Card className="shadow-card border-border/50 overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs uppercase tracking-wider font-semibold">Armário</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-semibold">Localização</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-semibold text-center">Portas</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-semibold">Ocupação</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-semibold text-center">Livres</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-semibold text-center">Ocupados</TableHead>
                  <TableHead className="text-xs uppercase tracking-wider font-semibold text-center">Manut.</TableHead>
                  {isAdmin && <TableHead className="text-xs uppercase tracking-wider font-semibold text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLockers.map((locker) => {
                  const totalOriginalDoors = lockers.find(l => l.id === locker.id)?.doors.length || 0;
                  const available = locker.doors.filter((d) => d.status === "available").length;
                  const occupied = locker.doors.filter((d) => d.status === "occupied").length;
                  const maintenance = locker.doors.filter((d) => d.status === "maintenance").length;
                  const occupationPct = totalOriginalDoors > 0 ? Math.round((occupied / totalOriginalDoors) * 100) : 0;

                  return (
                    <TableRow key={locker.id} className="cursor-pointer hover:bg-muted/30">
                      <TableCell className="font-semibold text-sm">{locker.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          {locker.location || "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-sm font-medium">{locker.doors.length}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[120px]">
                          <Progress value={occupationPct} className="h-2 flex-1" />
                          <span className="text-xs text-muted-foreground font-mono w-10 text-right">{occupationPct}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-[11px]">{available}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[11px]">{occupied}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20 text-[11px]">{maintenance}</Badge>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(locker)}>
                              <Filter className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteLocker(locker)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
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
        isAdmin={isAdmin}
        onSetMaintenance={handleSetMaintenance}
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
