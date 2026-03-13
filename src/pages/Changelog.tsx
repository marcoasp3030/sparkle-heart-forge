import { useState, useEffect } from "react";
import { get } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  FileText, GitCommit, Tag, Calendar, Plus, Wrench,
  AlertTriangle, Trash2, Shield, Zap, ArrowLeft, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface ChangelogVersion {
  version: string;
  date: string;
  categories: Record<string, string[]>;
}

interface ChangelogData {
  currentVersion: string;
  versions: ChangelogVersion[];
  commits: Array<{ hash: string; date: string; message: string; author: string }>;
  hasChangelogFile: boolean;
}

const CATEGORY_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  "Adicionado": { icon: <Plus className="h-3.5 w-3.5" />, color: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  "Alterado": { icon: <Wrench className="h-3.5 w-3.5" />, color: "bg-blue-500/15 text-blue-700 border-blue-500/30" },
  "Corrigido": { icon: <Wrench className="h-3.5 w-3.5" />, color: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  "Removido": { icon: <Trash2 className="h-3.5 w-3.5" />, color: "bg-destructive/15 text-destructive border-destructive/30" },
  "Segurança": { icon: <Shield className="h-3.5 w-3.5" />, color: "bg-purple-500/15 text-purple-700 border-purple-500/30" },
  "Depreciado": { icon: <AlertTriangle className="h-3.5 w-3.5" />, color: "bg-orange-500/15 text-orange-700 border-orange-500/30" },
  "Melhorado": { icon: <Zap className="h-3.5 w-3.5" />, color: "bg-cyan-500/15 text-cyan-700 border-cyan-500/30" },
};

function getCategoryStyle(category: string) {
  return CATEGORY_CONFIG[category] || { icon: <FileText className="h-3.5 w-3.5" />, color: "bg-muted text-muted-foreground" };
}

export default function Changelog() {
  const [data, setData] = useState<ChangelogData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    get<ChangelogData>("/changelog")
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Não foi possível carregar o changelog.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <FileText className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold text-foreground">Changelog</h1>
            </div>
            <p className="text-muted-foreground">
              Histórico de versões e alterações do sistema
            </p>
            <div className="flex items-center gap-2 mt-3">
              <Badge variant="default" className="text-sm px-3 py-1">
                <Tag className="h-3.5 w-3.5 mr-1.5" />
                v{data.currentVersion}
              </Badge>
              <span className="text-sm text-muted-foreground">versão atual</span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </div>

        <Separator />

        <Tabs defaultValue={data.hasChangelogFile ? "releases" : "commits"}>
          <TabsList className="bg-muted/50 p-1 rounded-xl">
            {data.hasChangelogFile && (
              <TabsTrigger value="releases" className="rounded-lg gap-2">
                <Tag className="h-4 w-4" />
                Releases
              </TabsTrigger>
            )}
            <TabsTrigger value="commits" className="rounded-lg gap-2">
              <GitCommit className="h-4 w-4" />
              Commits
            </TabsTrigger>
          </TabsList>

          {/* Releases from CHANGELOG.md */}
          {data.hasChangelogFile && (
            <TabsContent value="releases" className="space-y-6 mt-6">
              {data.versions.map((version, idx) => (
                <Card key={idx} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-xl">
                        <Tag className="h-5 w-5 text-primary" />
                        v{version.version}
                      </CardTitle>
                      {version.date && (
                        <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(new Date(version.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {Object.entries(version.categories).map(([category, items]) => {
                      const style = getCategoryStyle(category);
                      return (
                        <div key={category}>
                          <Badge className={`${style.color} mb-3 gap-1.5`}>
                            {style.icon}
                            {category}
                          </Badge>
                          <ul className="space-y-1.5 ml-1">
                            {items.map((item, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                                <span className="text-muted-foreground mt-1.5 shrink-0">•</span>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          )}

          {/* Git commits */}
          <TabsContent value="commits" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitCommit className="h-5 w-5 text-primary" />
                  Commits Recentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.commits.length > 0 ? (
                  <ScrollArea className="h-[600px]">
                    <div className="space-y-1">
                      {data.commits.map((commit, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <code className="text-xs bg-muted px-2 py-1 rounded font-mono shrink-0 mt-0.5 text-primary">
                            {commit.hash}
                          </code>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground">{commit.message}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {commit.author}
                              {commit.date && (
                                <> • {format(new Date(commit.date), "dd/MM/yyyy HH:mm", { locale: ptBR })}</>
                              )}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhum commit disponível. O repositório Git pode não estar acessível.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
