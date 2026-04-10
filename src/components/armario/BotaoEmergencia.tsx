import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ShieldAlert, Unlock } from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";

interface BotaoEmergenciaProps {
  /** company_id para filtrar (opcional) */
  companyId?: string;
  /** Callback após sucesso */
  onSuccess?: () => void;
  className?: string;
}

export function BotaoEmergencia({ companyId, onSuccess, className }: BotaoEmergenciaProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const handleOpenAll = async () => {
    setIsLoading(true);
    try {
      // Buscar a API Key configurada para autenticação
      let apiKey = "";
      try {
        const { data: settingsData } = await api.get("/settings", {
          params: { key: "fechaduras_api_key" },
        });
        const rows = Array.isArray(settingsData) ? settingsData : settingsData?.data || [];
        const setting = rows.find?.((s: any) => s.key === "fechaduras_api_key");
        apiKey = typeof setting?.value === "string"
          ? setting.value
          : setting?.value?.key || "";
      } catch {
        console.warn("[EMERGENCIA] Não foi possível carregar API Key de fallback");
      }

      const payload: any = {};
      if (companyId) payload.company_id = companyId;

      // Tenta primeiro o endpoint /emergencia (JWT auth)
      // Se falhar com 403/404, tenta /abrir-tudo (API Key auth)
      let data: any;
      try {
        const response = await api.post("/fechaduras/emergencia", payload);
        data = response.data;
      } catch (jwtErr: any) {
        console.warn("[EMERGENCIA] Falha no endpoint JWT, tentando /abrir-tudo com API Key...", jwtErr?.status);
        
        const headers: any = { "Content-Type": "application/json" };
        if (apiKey) headers["X-API-Key"] = apiKey;

        const response = await api.post("/fechaduras/abrir-tudo", payload, { headers });
        data = response.data;
      }

      console.log("[EMERGENCIA] Sucesso:", data);

      toast.success("⚠️ Comando de Emergência Enviado!", {
        description: data.message || `O agente iniciará a abertura em instantes.`,
      });

      onSuccess?.();
    } catch (err: any) {
      console.error("[EMERGENCIA] Erro final:", err);
      toast.error("Falha ao executar emergência", {
        description: err?.response?.data?.error || err?.message || "Verifique a conexão com o servidor.",
      });
    } finally {
      setIsLoading(false);
      setOpen(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="destructive"
          className={`shadow-lg shadow-red-500/20 font-semibold tracking-wide gap-2 ${className || ""}`}
          disabled={isLoading}
        >
          <ShieldAlert className="w-4 h-4" />
          Emergência
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="w-5 h-5" />
            Abertura de Emergência
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block font-semibold text-destructive">
              ATENÇÃO: Esta ação abrirá TODAS as fechaduras físicas simultaneamente!
            </span>
            <span className="block">
              O comando será enviado ao agente IoT que disparará a abertura em broadcast
              para todas as placas controladoras configuradas. Esta ação é irreversível e
              será registrada nos logs de auditoria.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleOpenAll}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
          >
            <Unlock className="w-4 h-4" />
            {isLoading ? "Enviando comando..." : "Confirmar Abertura Total"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
