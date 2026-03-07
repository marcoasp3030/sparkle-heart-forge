import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { History, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  onRestore: (key: string, value: any) => void;
}

interface HistoryEntry {
  id: string;
  setting_key: string;
  value: any;
  created_at: string;
}

const KEY_LABELS: Record<string, string> = {
  theme_colors: "Cores",
  branding: "Textos",
  images: "Imagens",
};

export default function HistoricoConfiguracoes({ onRestore }: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    supabase
      .from("platform_settings_history")
      .select("id, setting_key, value, created_at")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setEntries((data as HistoryEntry[]) || []);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <p className="text-xs text-muted-foreground py-4 text-center">Carregando histórico...</p>;
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p className="text-xs">Nenhuma alteração registrada ainda.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
      {entries.map((entry) => (
        <div key={entry.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-muted/20 text-xs">
          <div className="flex-1">
            <span className="font-medium text-foreground">{KEY_LABELS[entry.setting_key] || entry.setting_key}</span>
            <span className="text-muted-foreground ml-2">
              {format(new Date(entry.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => {
              onRestore(entry.setting_key, entry.value);
              toast({ title: "Restaurado!", description: `Configuração de ${KEY_LABELS[entry.setting_key] || entry.setting_key} restaurada. Salve para aplicar.` });
            }}
          >
            <RotateCcw className="h-3 w-3" /> Restaurar
          </Button>
        </div>
      ))}
    </div>
  );
}
