import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Lock, Unlock, Package, MapPin, Settings, Bell, Search,
  ChevronRight, LogOut, Shield, LayoutDashboard, Archive,
  BarChart3, Wrench, ChevronDown, Menu
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
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

const statusConfig = {
  occupied: { label: "Ocupado", className: "bg-primary/10 text-primary border-primary/20" },
  available: { label: "Disponível", className: "bg-success/10 text-success border-success/20" },
  maintenance: { label: "Manutenção", className: "bg-accent/10 text-accent border-accent/20" },
};

const stats = [
  { label: "Total", value: "48", icon: Lock, sublabel: "armários cadastrados" },
  { label: "Disponíveis", value: "21", icon: Unlock, sublabel: "+3 hoje", accent: "success" },
  { label: "Ocupados", value: "25", icon: Package, sublabel: "em uso agora", accent: "primary" },
  { label: "Manutenção", value: "2", icon: Wrench, sublabel: "-1 hoje", accent: "accent" },
];

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", active: true },
  { icon: Archive, label: "Armários" },
  { icon: BarChart3, label: "Relatórios" },
  { icon: Settings, label: "Configurações" },
];

const Index = () => {
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [profileName, setProfileName] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("role, full_name")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.role === "superadmin") setIsSuperAdmin(true);
        if (data?.full_name) setProfileName(data.full_name);
      });
  }, [user]);

  const filtered = lockerData.filter(
    (l) =>
      l.id.toLowerCase().includes(search.toLowerCase()) ||
      l.location.toLowerCase().includes(search.toLowerCase()) ||
      (l.user && l.user.toLowerCase().includes(search.toLowerCase()))
  );

  const displayName = profileName || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuário";
  const initials = displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-64" : "w-[72px]"} fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300 ease-in-out`}>
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 px-4 border-b border-sidebar-border">
          <img src={lockerLogo} alt="PB One Locker" className="h-8 w-8 object-contain flex-shrink-0" />
          {sidebarOpen && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sidebar-primary-foreground font-bold text-sm tracking-tight"
            >
              PB One Locker
            </motion.span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.label}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                item.active
                  ? "bg-sidebar-accent text-sidebar-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              }`}
            >
              <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          ))}

          {isSuperAdmin && (
            <>
              <div className={`my-3 mx-3 h-px bg-sidebar-border ${!sidebarOpen ? "mx-1" : ""}`} />
              <button
                onClick={() => navigate("/admin")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-colors"
              >
                <Shield className="h-[18px] w-[18px] flex-shrink-0" />
                {sidebarOpen && <span>Admin</span>}
              </button>
            </>
          )}
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-sidebar-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-sidebar-accent/50 transition-colors">
                <div className="h-8 w-8 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-xs font-bold flex-shrink-0">
                  {initials}
                </div>
                {sidebarOpen && (
                  <>
                    <div className="flex-1 text-left min-w-0">
                      <p className="text-xs font-semibold text-sidebar-accent-foreground truncate">{displayName}</p>
                      <p className="text-[10px] text-sidebar-foreground truncate">{user?.email}</p>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 text-sidebar-foreground flex-shrink-0" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem>Meu Perfil</DropdownMenuItem>
              <DropdownMenuItem>Preferências</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main content */}
      <div className={`flex-1 ${sidebarOpen ? "ml-64" : "ml-[72px]"} transition-all duration-300`}>
        {/* Top bar */}
        <header className="sticky top-0 z-40 h-16 border-b border-border bg-background/80 backdrop-blur-xl flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="h-9 w-9">
              <Menu className="h-4 w-4" />
            </Button>
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                className="w-64 pl-9 h-9 bg-muted/50 border-transparent focus:border-border"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative h-9 w-9">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
            </Button>
          </div>
        </header>

        <main className="p-6 lg:p-8">
          {/* Page heading */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-8"
          >
            <h1 className="text-2xl font-bold text-foreground">
              Painel de Controle
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Gerencie os armários inteligentes em tempo real.
            </p>
          </motion.div>

          {/* Stats */}
          <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.08 }}
              >
                <Card className="shadow-card hover:shadow-elevated transition-shadow duration-300 border-border/50">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className={`rounded-lg p-2 ${
                        stat.accent === "success" ? "bg-success/10" :
                        stat.accent === "primary" ? "bg-primary/10" :
                        stat.accent === "accent" ? "bg-accent/10" :
                        "bg-muted"
                      }`}>
                        <stat.icon className={`h-4 w-4 ${
                          stat.accent === "success" ? "text-success" :
                          stat.accent === "primary" ? "text-primary" :
                          stat.accent === "accent" ? "text-accent" :
                          "text-muted-foreground"
                        }`} />
                      </div>
                    </div>
                    <p className="text-3xl font-extrabold text-foreground tracking-tight">{stat.value}</p>
                    <p className="text-sm font-medium text-muted-foreground mt-0.5">{stat.label}</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">{stat.sublabel}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Locker List */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <Card className="shadow-card border-border/50 overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-bold text-foreground">Armários</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Visão geral de todos os armários</p>
                </div>
                <div className="relative w-full sm:w-64 sm:hidden">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar armário..."
                    className="pl-9 h-9 bg-muted/50 border-transparent"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="divide-y divide-border/50">
                {filtered.map((locker, i) => (
                  <motion.div
                    key={locker.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.35 + i * 0.04 }}
                    className="flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${
                        statusConfig[locker.status as keyof typeof statusConfig].className
                      }`}>
                        {locker.status === "occupied" ? (
                          <Lock className="h-4 w-4" />
                        ) : locker.status === "available" ? (
                          <Unlock className="h-4 w-4" />
                        ) : (
                          <Wrench className="h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground font-mono">{locker.id}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <MapPin className="h-3 w-3" />
                          {locker.location}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {locker.user && (
                        <div className="hidden text-right sm:block">
                          <p className="text-sm font-medium text-foreground">{locker.user}</p>
                          <p className="text-[11px] text-muted-foreground">Desde {locker.since}</p>
                        </div>
                      )}
                      <Badge variant="outline" className={`text-[11px] font-medium px-2.5 py-0.5 ${
                        statusConfig[locker.status as keyof typeof statusConfig].className
                      }`}>
                        {statusConfig[locker.status as keyof typeof statusConfig].label}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </motion.div>
                ))}
                {filtered.length === 0 && (
                  <div className="px-6 py-16 text-center text-muted-foreground text-sm">
                    Nenhum armário encontrado.
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        </main>
      </div>
    </div>
  );
};

export default Index;
