import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Lock, Unlock, Package, MapPin, BarChart3, Settings, Bell, Search, ChevronRight, LogOut, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import lockerLogo from "@/assets/locker-logo.png";

const lockerData = [
  { id: "A-001", location: "Lobby Principal", status: "occupied", user: "João Silva", since: "14:30" },
  { id: "A-002", location: "Lobby Principal", status: "available", user: null, since: null },
  { id: "A-003", location: "Lobby Principal", status: "occupied", user: "Maria Santos", since: "09:15" },
  { id: "B-001", location: "Ala Norte", status: "available", user: null, since: null },
  { id: "B-002", location: "Ala Norte", status: "maintenance", user: null, since: null },
  { id: "B-003", location: "Ala Norte", status: "occupied", user: "Carlos Oliveira", since: "11:00" },
  { id: "C-001", location: "Ala Sul", status: "available", user: null, since: null },
  { id: "C-002", location: "Ala Sul", status: "occupied", user: "Ana Costa", since: "16:45" },
];

const statusMap = {
  occupied: { label: "Ocupado", color: "bg-primary text-primary-foreground" },
  available: { label: "Disponível", color: "bg-emerald-500 text-white" },
  maintenance: { label: "Manutenção", color: "bg-accent text-accent-foreground" },
};

const stats = [
  { label: "Total de Armários", value: "48", icon: Lock, change: null },
  { label: "Disponíveis", value: "21", icon: Unlock, change: "+3 hoje" },
  { label: "Ocupados", value: "25", icon: Package, change: null },
  { label: "Manutenção", value: "2", icon: Settings, change: "-1 hoje" },
];

const Index = () => {
  const [search, setSearch] = useState("");
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.role === "superadmin") setIsSuperAdmin(true);
      });
  }, [user]);

  const filtered = lockerData.filter(
    (l) =>
      l.id.toLowerCase().includes(search.toLowerCase()) ||
      l.location.toLowerCase().includes(search.toLowerCase()) ||
      (l.user && l.user.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <img src={lockerLogo} alt="PB One Locker" className="h-10" />
          </div>
          <nav className="hidden items-center gap-1 md:flex">
            {["Dashboard", "Armários", "Relatórios", "Configurações"].map((item) => (
              <Button key={item} variant={item === "Dashboard" ? "default" : "ghost"} size="sm">
                {item}
              </Button>
            ))}
          </nav>
            {isSuperAdmin && (
              <Button variant="outline" size="sm" onClick={() => navigate("/admin")} className="gap-1.5">
                <Shield className="h-4 w-4" />
                Admin
              </Button>
            )}
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary" />
            </Button>
            <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-semibold">
              {user?.user_metadata?.full_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <Button variant="ghost" size="icon" onClick={signOut} title="Sair">
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Welcome */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Painel de Controle
          </h1>
          <p className="mt-1 text-muted-foreground">
            Gerencie os armários inteligentes em tempo real.
          </p>
        </motion.div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
            >
              <Card className="overflow-hidden border-border/60 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="rounded-lg bg-primary/10 p-2.5">
                      <stat.icon className="h-5 w-5 text-primary" />
                    </div>
                    {stat.change && (
                      <span className="text-xs font-medium text-emerald-600">{stat.change}</span>
                    )}
                  </div>
                  <p className="mt-3 text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Locker List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Card className="border-border/60 shadow-sm">
            <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Armários</h2>
                <p className="text-sm text-muted-foreground">Visão geral de todos os armários</p>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar armário..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="divide-y divide-border">
              {filtered.map((locker, i) => (
                <motion.div
                  key={locker.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between px-5 py-4 hover:bg-muted/50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                      locker.status === "occupied" ? "bg-primary/10" :
                      locker.status === "available" ? "bg-emerald-500/10" :
                      "bg-accent/10"
                    }`}>
                      {locker.status === "occupied" ? (
                        <Lock className={`h-5 w-5 ${locker.status === "occupied" ? "text-primary" : ""}`} />
                      ) : locker.status === "available" ? (
                        <Unlock className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <Settings className="h-5 w-5 text-accent" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{locker.id}</p>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        {locker.location}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {locker.user && (
                      <div className="hidden text-right sm:block">
                        <p className="text-sm font-medium text-foreground">{locker.user}</p>
                        <p className="text-xs text-muted-foreground">Desde {locker.since}</p>
                      </div>
                    )}
                    <Badge className={statusMap[locker.status as keyof typeof statusMap].color}>
                      {statusMap[locker.status as keyof typeof statusMap].label}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </motion.div>
              ))}
              {filtered.length === 0 && (
                <div className="px-5 py-12 text-center text-muted-foreground">
                  Nenhum armário encontrado.
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      </main>
    </div>
  );
};

export default Index;
