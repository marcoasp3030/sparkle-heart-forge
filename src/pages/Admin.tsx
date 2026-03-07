import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Shield, Users, ArrowLeft, Save } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import lockerLogo from "@/assets/locker-logo.png";

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  role: string | null;
  created_at: string;
  avatar_url: string | null;
}

const ROLES = ["user", "admin", "superadmin"];

const roleBadgeVariant = (role: string | null) => {
  switch (role) {
    case "superadmin": return "default";
    case "admin": return "secondary";
    default: return "outline";
  }
};

const Admin = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (data?.role !== "superadmin") {
        navigate("/");
        return;
      }
      setIsSuperAdmin(true);
      fetchProfiles();
    };
    checkAccess();
  }, [user]);

  const fetchProfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      toast({ title: "Erro ao carregar usuários", description: error.message, variant: "destructive" });
    } else {
      setProfiles(data || []);
    }
    setLoading(false);
  };

  const handleRoleChange = (userId: string, newRole: string) => {
    setPendingChanges((prev) => ({ ...prev, [userId]: newRole }));
  };

  const saveChanges = async () => {
    setSaving(true);
    const entries = Object.entries(pendingChanges);
    let errors = 0;

    for (const [userId, role] of entries) {
      const { error } = await supabase
        .from("profiles")
        .update({ role })
        .eq("user_id", userId);
      if (error) errors++;
    }

    if (errors > 0) {
      toast({ title: "Erro", description: `${errors} alteração(ões) falharam.`, variant: "destructive" });
    } else {
      toast({ title: "Salvo!", description: `${entries.length} permissão(ões) atualizada(s).` });
      setPendingChanges({});
      fetchProfiles();
    }
    setSaving(false);
  };

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <img src={lockerLogo} alt="PB One Locker" className="h-10" />
            <Badge variant="default" className="gap-1">
              <Shield className="h-3 w-3" />
              Super Admin
            </Badge>
          </div>
          <Button variant="ghost" onClick={() => navigate("/")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Dashboard
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            Gestão de Usuários
          </h1>
          <p className="mt-1 text-muted-foreground">
            Gerencie permissões e roles dos usuários do sistema.
          </p>
        </motion.div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
          {[
            { label: "Total de Usuários", value: profiles.length },
            { label: "Administradores", value: profiles.filter((p) => p.role === "admin" || p.role === "superadmin").length },
            { label: "Usuários Comuns", value: profiles.filter((p) => p.role === "user" || !p.role).length },
          ].map((stat, i) => (
            <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card className="border-border/60">
                <CardContent className="p-5">
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Users Table */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Usuários</CardTitle>
              {Object.keys(pendingChanges).length > 0 && (
                <Button onClick={saveChanges} disabled={saving} className="gap-2">
                  <Save className="h-4 w-4" />
                  {saving ? "Salvando..." : `Salvar (${Object.keys(pendingChanges).length})`}
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>ID do Usuário</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead>Role Atual</TableHead>
                      <TableHead>Nova Role</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profiles.map((profile) => {
                      const currentRole = pendingChanges[profile.user_id] || profile.role || "user";
                      const hasChange = pendingChanges[profile.user_id] !== undefined;
                      const isCurrentUser = profile.user_id === user?.id;

                      return (
                        <TableRow key={profile.id} className={hasChange ? "bg-primary/5" : ""}>
                          <TableCell className="font-medium">
                            {profile.full_name || "Sem nome"}
                            {isCurrentUser && (
                              <span className="ml-2 text-xs text-muted-foreground">(você)</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {profile.user_id.slice(0, 8)}...
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(profile.created_at).toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell>
                            <Badge variant={roleBadgeVariant(profile.role)}>
                              {profile.role || "user"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={currentRole}
                              onValueChange={(v) => handleRoleChange(profile.user_id, v)}
                              disabled={isCurrentUser}
                            >
                              <SelectTrigger className="w-36">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ROLES.map((r) => (
                                  <SelectItem key={r} value={r}>
                                    {r}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
};

export default Admin;
