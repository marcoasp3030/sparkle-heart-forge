import { useState, useRef } from "react";
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, X } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ImportRow {
  nome: string;
  email?: string;
  telefone?: string;
  cargo?: string;
  matricula?: string;
  tipo?: string;
}

interface ImportacaoMassaProps {
  companyId: string;
  onImportComplete: () => void;
}

const TEMPLATE_COLUMNS = ["nome", "email", "telefone", "cargo", "matricula", "tipo"];
const TEMPLATE_EXAMPLE: ImportRow[] = [
  { nome: "João Silva", email: "joao@email.com", telefone: "(11) 99999-0000", cargo: "Analista", matricula: "MAT001", tipo: "funcionario" },
  { nome: "Maria Santos", email: "maria@email.com", telefone: "(11) 98888-0000", cargo: "Gerente", matricula: "MAT002", tipo: "funcionario" },
  { nome: "Carlos Oliveira", email: "carlos@email.com", telefone: "", cargo: "", matricula: "", tipo: "cliente" },
];

export default function ImportacaoMassa({ companyId, onImportComplete }: ImportacaoMassaProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [preview, setPreview] = useState<ImportRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState("");

  const downloadTemplate = (format: "csv" | "xlsx") => {
    const ws = XLSX.utils.json_to_sheet(TEMPLATE_EXAMPLE, { header: TEMPLATE_COLUMNS });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Modelo");

    if (format === "csv") {
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "modelo_importacao.csv";
      a.click();
      URL.revokeObjectURL(url);
    } else {
      XLSX.writeFile(wb, "modelo_importacao.xlsx");
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws);

      const validationErrors: string[] = [];
      const parsed: ImportRow[] = [];

      rows.forEach((row, i) => {
        const nome = String(row.nome || row.Nome || row.NOME || "").trim();
        if (!nome) {
          validationErrors.push(`Linha ${i + 2}: Nome é obrigatório`);
          return;
        }
        const tipo = String(row.tipo || row.Tipo || row.TIPO || "funcionario").toLowerCase().trim();
        if (tipo !== "funcionario" && tipo !== "cliente") {
          validationErrors.push(`Linha ${i + 2}: Tipo deve ser "funcionario" ou "cliente"`);
          return;
        }
        parsed.push({
          nome,
          email: String(row.email || row.Email || row.EMAIL || "").trim() || undefined,
          telefone: String(row.telefone || row.Telefone || row.TELEFONE || "").trim() || undefined,
          cargo: String(row.cargo || row.Cargo || row.CARGO || "").trim() || undefined,
          matricula: String(row.matricula || row.Matricula || row.MATRICULA || "").trim() || undefined,
          tipo,
        });
      });

      setPreview(parsed);
      setErrors(validationErrors);
      setDialogOpen(true);
    } catch {
      toast({ title: "Erro ao ler arquivo", description: "Verifique se o arquivo é um CSV ou Excel válido.", variant: "destructive" });
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImport = async () => {
    if (preview.length === 0) return;
    setImporting(true);

    const payload = preview.map((row) => ({
      company_id: companyId,
      nome: row.nome,
      email: row.email || null,
      telefone: row.telefone || null,
      cargo: row.cargo || null,
      matricula: row.matricula || null,
      tipo: row.tipo || "funcionario",
    }));

    const { error } = await supabase.from("funcionarios_clientes").insert(payload);
    if (error) {
      toast({ title: "Erro na importação", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${preview.length} registros importados com sucesso!` });
      setDialogOpen(false);
      setPreview([]);
      onImportComplete();
    }
    setImporting(false);
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs sm:text-sm" onClick={() => downloadTemplate("xlsx")}>
          <Download className="h-3.5 w-3.5" /> Modelo Excel
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs sm:text-sm" onClick={() => downloadTemplate("csv")}>
          <Download className="h-3.5 w-3.5" /> Modelo CSV
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 rounded-xl text-xs sm:text-sm" onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-3.5 w-3.5" /> Importar
        </Button>
        <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileSelect} />
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              Pré-visualização da Importação
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Arquivo: <span className="font-medium text-foreground">{fileName}</span>
              </p>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                {preview.length} registros
              </Badge>
            </div>

            {errors.length > 0 && (
              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="p-3 space-y-1">
                  {errors.map((err, i) => (
                    <p key={i} className="text-xs text-destructive flex items-center gap-1.5">
                      <AlertCircle className="h-3 w-3 shrink-0" /> {err}
                    </p>
                  ))}
                </CardContent>
              </Card>
            )}

            {preview.length > 0 && (
              <ScrollArea className="h-[300px] rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Nome</TableHead>
                      <TableHead className="text-xs">E-mail</TableHead>
                      <TableHead className="text-xs">Telefone</TableHead>
                      <TableHead className="text-xs">Cargo</TableHead>
                      <TableHead className="text-xs">Matrícula</TableHead>
                      <TableHead className="text-xs">Tipo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs font-medium">{row.nome}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{row.email || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{row.telefone || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{row.cargo || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{row.matricula || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${row.tipo === "funcionario" ? "bg-secondary/10 text-secondary border-secondary/20" : "bg-accent/10 text-accent border-accent/20"}`}>
                            {row.tipo === "funcionario" ? "Func." : "Cliente"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" className="rounded-xl">Cancelar</Button>
            </DialogClose>
            <Button
              onClick={handleImport}
              disabled={importing || preview.length === 0}
              className="gradient-primary border-0 rounded-xl hover:opacity-90 gap-1.5"
            >
              {importing ? "Importando..." : (
                <><CheckCircle2 className="h-4 w-4" /> Confirmar Importação</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
