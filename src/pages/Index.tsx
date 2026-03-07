import { useState } from "react";
import { motion } from "framer-motion";
import {
  Lock, Unlock, Package, MapPin, Search,
  ChevronRight, Wrench
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

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

const Index = () => {
  const [search, setSearch] = useState("");

  const filtered = lockerData.filter(
    (l) =>
      l.id.toLowerCase().includes(search.toLowerCase()) ||
      l.location.toLowerCase().includes(search.toLowerCase()) ||
      (l.user && l.user.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-8">
      {/* Page heading */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold text-foreground">Painel de Controle</h1>
        <p className="mt-1 text-sm text-muted-foreground">Gerencie os armários inteligentes em tempo real.</p>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: i * 0.08 }}>
            <Card className="shadow-card hover:shadow-elevated transition-shadow duration-300 border-border/50">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className={`rounded-lg p-2 ${
                    stat.accent === "success" ? "bg-success/10" :
                    stat.accent === "primary" ? "bg-primary/10" :
                    stat.accent === "accent" ? "bg-accent/10" : "bg-muted"
                  }`}>
                    <stat.icon className={`h-4 w-4 ${
                      stat.accent === "success" ? "text-success" :
                      stat.accent === "primary" ? "text-primary" :
                      stat.accent === "accent" ? "text-accent" : "text-muted-foreground"
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
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}>
        <Card className="shadow-card border-border/50 overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground">Armários</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Visão geral de todos os armários</p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar armário..." className="pl-9 h-9 bg-muted/50 border-transparent" value={search} onChange={(e) => setSearch(e.target.value)} />
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
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${statusConfig[locker.status as keyof typeof statusConfig].className}`}>
                    {locker.status === "occupied" ? <Lock className="h-4 w-4" /> : locker.status === "available" ? <Unlock className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
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
                  <Badge variant="outline" className={`text-[11px] font-medium px-2.5 py-0.5 ${statusConfig[locker.status as keyof typeof statusConfig].className}`}>
                    {statusConfig[locker.status as keyof typeof statusConfig].label}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </motion.div>
            ))}
            {filtered.length === 0 && (
              <div className="px-6 py-16 text-center text-muted-foreground text-sm">Nenhum armário encontrado.</div>
            )}
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default Index;
