import { useState, useEffect } from "react";
import { Clock, UserCheck, Calendar, Lock, Unlock, Search, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/ContextoEmpresa";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface OccupiedDoorReport {
  id: string;
  door_number: number;
  label: string | null;
  size: string;
  usage_type: string;
  expires_at: string | null;
  occupied_at: string | null;
  locker_name: string;
  locker_location: string;
  person_name: string | null;
  person_type: string | null;
  person_matricula: string | null;
}

interface RelatorioOcupacaoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function RelatorioOcupacao({ open, onOpenChange }: RelatorioOcupacaoProps) {
  const { selectedCompany } = useCompany();
  const [data, setData] = useState<OccupiedDoorReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  useEffect(() => {
    if (!open || !selectedCompany) return;
    const fetch = async () => {
      setLoading(true);
      // Get occupied doors with locker info
      const { data: doors } = await supabase
        .from("locker_doors")
        .select("id, door_number, label, size, usage_type, expires_at, occupied_at, occupied_by_person, locker_id")
        .eq("status", "occupied");

      if (!doors || doors.length === 0) {
        setData([]);
        setLoading(false);
        return;
      }

      // Get locker info
      const lockerIds = [...new Set(doors.map(d => d.locker_id))];
      const { data: lockers } = await supabase
        .from("lockers")
        .select("id, name, location")
        .in("id", lockerIds);

      // Get person info
      const personIds = doors.map(d => d.occupied_by_person).filter(Boolean) as string[];
      let persons: any[] = [];
      if (personIds.length > 0) {
        const { data: p } = await supabase
          .from("funcionarios_clientes")
          .select("id, nome, tipo, matricula")
          .in("id", personIds);
        persons = p || [];
      }

      const lockersMap = new Map((lockers || []).map(l => [l.id, l]));
      const personsMap = new Map(persons.map(p => [p.id, p]));

      const report: OccupiedDoorReport[] = doors.map(d => {
        const locker = lockersMap.get(d.locker_id);
        const person = d.occupied_by_person ? personsMap.get(d.occupied_by_person) : null;
        return {
          id: d.id,
          door_number: d.door_number,
          label: d.label,
          size: d.size,
          usage_type: d.usage_type || "temporary",
          expires_at: d.expires_at,
          occupied_at: d.occupied_at,
          locker_name: locker?.name || "—",
          locker_location: locker?.location || "—",
          person_name: person?.nome || null,
          person_type: person?.tipo || null,
          person_matricula: person?.matricula || null,
        };
      });

      setData(report);
      setLoading(false);
    };
    fetch();
  }, [open, selectedCompany]);

  const filtered = data.filter(d => {
    const matchSearch = !search || 
      (d.person_name?.toLowerCase().includes(search.toLowerCase())) ||
      d.locker_name.toLowerCase().includes(search.toLowerCase()) ||
      String(d.door_number).includes(search);
    const matchType = filterType === "all" || d.usage_type === filterType;
    return matchSearch && matchType;
  });

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const handleExportCSV = () => {
    const headers = ["Armário", "Localização", "Porta", "Pessoa", "Tipo Pessoa", "Matrícula", "Uso", "Ocupado em", "Expira em"];
    const rows = filtered.map(d => [
      d.locker_name,
      d.locker_location,
      d.label || `#${d.door_number}`,
      d.person_name || "—",
      d.person_type === "funcionario" ? "Funcionário" : d.person_type === "cliente" ? "Cliente" : "—",
      d.person_matricula || "—",
      d.usage_type === "permanent" ? "Permanente" : "Temporário",
      d.occupied_at ? new Date(d.occupied_at).toLocaleDateString("pt-BR") : "—",
      d.expires_at ? new Date(d.expires_at).toLocaleDateString("pt-BR") : "—",
    ]);
    const csv = [headers, ...rows].map(r => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-ocupacao-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] rounded-2xl p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40">
          <DialogTitle className="text-lg font-bold">Relatório de Ocupação</DialogTitle>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por pessoa, armário ou porta..."
                className="pl-9 h-9 bg-muted/50 border-transparent text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-9 w-auto min-w-[140px] bg-muted/50 border-transparent text-xs">
                <SelectValue placeholder="Tipo de uso" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todos os tipos</SelectItem>
                <SelectItem value="permanent" className="text-xs">Permanente</SelectItem>
                <SelectItem value="temporary" className="text-xs">Temporário</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs" onClick={handleExportCSV}>
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
          </div>
        </DialogHeader>

        <div className="overflow-auto max-h-[60vh] px-2">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Lock className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma porta ocupada encontrada.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Armário</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Porta</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Pessoa</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Tipo</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Uso</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Ocupado em</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wider font-semibold">Expira em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d) => (
                  <TableRow key={d.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{d.locker_name}</p>
                        <p className="text-[11px] text-muted-foreground">{d.locker_location}</p>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm font-medium">
                      {d.label || `#${d.door_number}`}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium">{d.person_name || "—"}</p>
                          {d.person_matricula && (
                            <p className="text-[11px] text-muted-foreground">{d.person_matricula}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${
                        d.person_type === "funcionario"
                          ? "bg-primary/10 text-primary border-primary/20"
                          : "bg-accent/10 text-accent border-accent/20"
                      }`}>
                        {d.person_type === "funcionario" ? "Funcionário" : d.person_type === "cliente" ? "Cliente" : "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${
                        d.usage_type === "permanent"
                          ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                          : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                      }`}>
                        <Clock className="h-3 w-3 mr-1" />
                        {d.usage_type === "permanent" ? "Permanente" : "Temporário"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {d.occupied_at ? new Date(d.occupied_at).toLocaleDateString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell>
                      {d.expires_at ? (
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className={`text-xs font-medium ${isExpired(d.expires_at) ? "text-destructive" : "text-muted-foreground"}`}>
                            {new Date(d.expires_at).toLocaleDateString("pt-BR")}
                          </span>
                          {isExpired(d.expires_at) && (
                            <Badge variant="destructive" className="text-[9px] px-1.5 py-0">Expirado</Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="px-6 py-3 border-t border-border/40 text-xs text-muted-foreground">
          {filtered.length} porta(s) ocupada(s)
          {filterType !== "all" && ` • Filtro: ${filterType === "permanent" ? "Permanente" : "Temporário"}`}
        </div>
      </DialogContent>
    </Dialog>
  );
}
