import { useState, useEffect } from "react";
import { Filter, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/lib/supabase-compat";
import { useCompany } from "@/contexts/ContextoEmpresa";

export interface DashboardFilters {
  period: "today" | "7d" | "30d" | "all";
  lockerId: string | null;
  status: string | null;
}

interface Props {
  filters: DashboardFilters;
  onChange: (filters: DashboardFilters) => void;
}

const PERIODS = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "all", label: "Todos" },
];

const STATUSES = [
  { value: "all", label: "Todos os status" },
  { value: "available", label: "Disponível" },
  { value: "occupied", label: "Ocupado" },
  { value: "maintenance", label: "Manutenção" },
  { value: "hygienizing", label: "Higienização" },
];

export default function FiltrosDashboard({ filters, onChange }: Props) {
  const { selectedCompany } = useCompany();
  const [lockers, setLockers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!selectedCompany) return;
    supabase
      .from("lockers")
      .select("id, name")
      .eq("company_id", selectedCompany.id)
      .order("name")
      .then(({ data }) => setLockers(data || []));
  }, [selectedCompany]);

  const activeCount = [
    filters.period !== "all" ? 1 : 0,
    filters.lockerId ? 1 : 0,
    filters.status ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const clearFilters = () => onChange({ period: "all", lockerId: null, status: null });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Filter className="h-3.5 w-3.5" />
        Filtros
        {activeCount > 0 && (
          <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{activeCount}</Badge>
        )}
      </div>

      {/* Period */}
      <div className="flex rounded-lg border border-border/40 overflow-hidden">
        {PERIODS.map(p => (
          <button
            key={p.value}
            onClick={() => onChange({ ...filters, period: p.value as DashboardFilters["period"] })}
            className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
              filters.period === p.value
                ? "bg-primary text-primary-foreground"
                : "bg-card hover:bg-muted/50 text-muted-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Locker filter */}
      {lockers.length > 1 && (
        <Select
          value={filters.lockerId || "all"}
          onValueChange={v => onChange({ ...filters, lockerId: v === "all" ? null : v })}
        >
          <SelectTrigger className="h-7 w-36 text-[11px] border-border/40">
            <SelectValue placeholder="Armário" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Todos armários</SelectItem>
            {lockers.map(l => (
              <SelectItem key={l.id} value={l.id} className="text-xs">{l.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Status filter */}
      <Select
        value={filters.status || "all"}
        onValueChange={v => onChange({ ...filters, status: v === "all" ? null : v })}
      >
        <SelectTrigger className="h-7 w-36 text-[11px] border-border/40">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map(s => (
            <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 px-2 text-[11px] text-muted-foreground">
          Limpar
        </Button>
      )}
    </div>
  );
}
