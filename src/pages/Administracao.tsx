import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Users, Save, UserPlus, Loader2 } from "lucide-react";
import { z } from "zod";
import { useAuth } from "@/contexts/ContextoAutenticacao";
import { supabase } from "@/lib/supabase-compat";
import { post } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  role: string | null;
  created_at: string;
  avatar_url: string | null;
}

const ROLES = ["user", "admin", "superadmin"];

const roleBadgeClass = (role: string | null) => {
  switch (role) {
    case "superadmin": return "bg-primary/10 text-primary border-primary/20";
    case "admin": return "bg-secondary/10 text-secondary border-secondary/20";
    default: return "bg-muted text-muted-foreground";
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
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            Gestão de Usuários
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Gerencie permissões e roles dos usuários do sistema.</p>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total de Usuários", value: profiles.length },
          { label: "Administradores", value: profiles.filter((p) => p.role === "admin" || p.role === "superadmin").length },
          { label: "Usuários Comuns", value: profiles.filter((p) => p.role === "user" || !p.role).length },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
            <Card className="shadow-card border-border/50">
              <CardContent className="p-5">
                <p className="text-3xl font-extrabold text-foreground tracking-tight">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{stat.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Users Table */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <Card className="shadow-card border-border/50 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border px-6">
            <CardTitle className="text-base font-bold">Usuários</CardTitle>
            {Object.keys(pendingChanges).length > 0 && (
              <Button onClick={saveChanges} disabled={saving} size="sm" className="gap-2 gradient-primary border-0 hover:opacity-90">
                <Save className="h-3.5 w-3.5" />
                {saving ? "Salvando..." : `Salvar (${Object.keys(pendingChanges).length})`}
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs uppercase tracking-wider font-semibold">Nome</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider font-semibold">ID</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider font-semibold">Criado em</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider font-semibold">Role</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider font-semibold">Alterar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((profile) => {
                    const currentRole = pendingChanges[profile.user_id] || profile.role || "user";
                    const hasChange = pendingChanges[profile.user_id] !== undefined;
                    const isCurrentUser = profile.user_id === user?.id;

                    return (
                      <TableRow key={profile.id} className={hasChange ? "bg-primary/5" : ""}>
                        <TableCell className="font-medium text-sm">
                          {profile.full_name || "Sem nome"}
                          {isCurrentUser && <span className="ml-2 text-[11px] text-muted-foreground">(você)</span>}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{profile.user_id.slice(0, 8)}…</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(profile.created_at).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[11px] ${roleBadgeClass(profile.role)}`}>{profile.role || "user"}</Badge>
                        </TableCell>
                        <TableCell>
                          <Select value={currentRole} onValueChange={(v) => handleRoleChange(profile.user_id, v)} disabled={isCurrentUser}>
                            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {ROLES.map((r) => (<SelectItem key={r} value={r} className="text-xs">{r}</SelectItem>))}
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
    </div>
  );
};

export default Admin;
