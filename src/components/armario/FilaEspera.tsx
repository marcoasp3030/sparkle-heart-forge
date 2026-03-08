import { useState, useEffect } from "react";
import { Users, UserPlus, UserMinus, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/ContextoAutenticacao";
import { useCompany } from "@/contexts/ContextoEmpresa";
import { useToast } from "@/hooks/use-toast";

interface WaitlistEntry {
  id: string;
  person_id: string;
  status: string;
  created_at: string;
  preferred_size: string;
  person_name?: string;
}

interface FilaEsperaProps {
  lockerId: string;
  lockerName: string;
  onRefresh?: () => void;
}

export default function FilaEspera({ lockerId, lockerName, onRefresh }: FilaEsperaProps) {
  const { user } = useAuth();
  const { selectedCompany, userRole, isSuperAdmin } = useCompany();
  const { toast } = useToast();
  const isAdmin = userRole === "admin" || isSuperAdmin;

  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [pessoas, setPessoas] = useState<{ id: string; nome: string }[]>([]);
  const [selectedPerson, setSelectedPerson] = useState("");
  const [preferredSize, setPreferredSize] = useState("any");

  const fetchWaitlist = async () => {
    const { data } = await supabase
      .from("locker_waitlist")
      .select("id, person_id, status, created_at, preferred_size")
      .eq("locker_id", lockerId)
      .eq("status", "waiting")
      .order("created_at", { ascending: true });

    if (data) {
      // Fetch person names
      const personIds = data.map(e => e.person_id);
      if (personIds.length > 0) {
        const { data: persons } = await supabase
          .from("funcionarios_clientes")
          .select("id, nome")
          .in("id", personIds);

        const nameMap = new Map(persons?.map(p => [p.id, p.nome]) || []);
        setEntries(data.map(e => ({ ...e, person_name: nameMap.get(e.person_id) || "—" })));
      } else {
        setEntries([]);
      }
    }
    setLoading(false);
  };

  const fetchPessoas = async () => {
    if (!selectedCompany) return;
    const { data } = await supabase
      .from("funcionarios_clientes")
      .select("id, nome")
      .eq("company_id", selectedCompany.id)
      .eq("ativo", true)
      .order("nome");
    setPessoas(data || []);
  };

  useEffect(() => {
    fetchWaitlist();
    fetchPessoas();
  }, [lockerId, selectedCompany]);

  const handleAdd = async () => {
    if (!selectedPerson || !selectedCompany || !user) return;
    setAdding(true);

    // Check if already in queue
    const { data: existing } = await supabase
      .from("locker_waitlist")
      .select("id")
      .eq("locker_id", lockerId)
      .eq("person_id", selectedPerson)
      .eq("status", "waiting")
      .maybeSingle();

    if (existing) {
      toast({ title: "Já na fila", description: "Esta pessoa já está na fila de espera.", variant: "destructive" });
      setAdding(false);
      return;
    }

    const { error } = await supabase.from("locker_waitlist").insert({
      company_id: selectedCompany.id,
      locker_id: lockerId,
      person_id: selectedPerson,
      requested_by: user.id,
      preferred_size: preferredSize,
      status: "waiting",
    });

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Adicionado à fila!", description: `Pessoa adicionada à fila de espera de ${lockerName}.` });
      setSelectedPerson("");
      fetchWaitlist();
    }
    setAdding(false);
  };

  const handleRemove = async (entryId: string) => {
    const { error } = await supabase
      .from("locker_waitlist")
      .update({ status: "cancelled" })
      .eq("id", entryId);

    if (!error) {
      toast({ title: "Removido da fila" });
      fetchWaitlist();
    }
  };

  const sizeLabels: Record<string, string> = {
    any: "Qualquer tamanho",
    small: "Pequeno",
    medium: "Médio",
    large: "Grande",
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          Fila de Espera
          {entries.length > 0 && (
            <Badge variant="secondary" className="ml-auto">{entries.length} na fila</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add to queue */}
        {isAdmin && (
          <div className="space-y-3 p-3 rounded-xl bg-muted/30 border border-border/50">
            <div className="space-y-2">
              <Label className="text-xs">Pessoa</Label>
              <Select value={selectedPerson} onValueChange={setSelectedPerson}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione uma pessoa" />
                </SelectTrigger>
                <SelectContent>
                  {pessoas.map(p => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Tamanho preferido</Label>
              <Select value={preferredSize} onValueChange={setPreferredSize}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any" className="text-xs">Qualquer</SelectItem>
                  <SelectItem value="small" className="text-xs">Pequeno</SelectItem>
                  <SelectItem value="medium" className="text-xs">Médio</SelectItem>
                  <SelectItem value="large" className="text-xs">Grande</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" className="w-full gap-1.5 text-xs" onClick={handleAdd} disabled={!selectedPerson || adding}>
              {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
              Adicionar à fila
            </Button>
          </div>
        )}

        {/* Queue list */}
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhuma pessoa na fila de espera.</p>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, idx) => (
              <div key={entry.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/20 border border-border/30">
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{entry.person_name}</p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(entry.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    {entry.preferred_size !== "any" && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0">{sizeLabels[entry.preferred_size]}</Badge>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleRemove(entry.id)}>
                    <UserMinus className="h-3 w-3 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
