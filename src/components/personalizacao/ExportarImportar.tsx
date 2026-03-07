import { useRef } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface Props {
  colors: Record<string, string>;
  branding: Record<string, string>;
  images: Record<string, string>;
  onImport: (data: { theme_colors?: any; branding?: any; images?: any }) => void;
}

export default function ExportarImportar({ colors, branding, images, onImport }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleExport = () => {
    const payload = { theme_colors: colors, branding, images };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `personalizacao-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exportado!", description: "Arquivo JSON baixado com sucesso." });
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (!data.theme_colors && !data.branding && !data.images) {
          toast({ title: "Formato inválido", description: "O arquivo não contém configurações válidas.", variant: "destructive" });
          return;
        }
        onImport(data);
        toast({ title: "Importado!", description: "Configurações carregadas. Salve para aplicar." });
      } catch {
        toast({ title: "Erro", description: "Não foi possível ler o arquivo JSON.", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={handleExport} className="gap-2 text-xs">
        <Download className="h-3.5 w-3.5" /> Exportar JSON
      </Button>
      <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} className="gap-2 text-xs">
        <Upload className="h-3.5 w-3.5" /> Importar JSON
      </Button>
      <input ref={inputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
    </div>
  );
}
