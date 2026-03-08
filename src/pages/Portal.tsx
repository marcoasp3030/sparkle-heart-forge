import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Archive, Clock, MapPin, User, LogOut, Sun, Moon, Bell, KeyRound, ChevronRight, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/ContextoAutenticacao";
import { useTheme } from "next-themes";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PersonInfo {
  id: string;
  nome: string;
  cargo: string | null;
  tipo: string;
  company_id: string;
}

interface DoorInfo {
  id: string;
  door_number: number;
  label: string | null;
  size: string;
  status: string;
  expires_at: string | null;
  occupied_at: string | null;
  locker: {
    name: string;
    location: string;
  };
}

interface ReservationInfo {
  id: string;
  starts_at: string;
  expires_at: string | null;
  status: string;
  usage_type: string;
  renewed_count: number;
}

export default function Portal() {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [person, setPerson] = useState<PersonInfo | null>(null);
  const [doors, setDoors] = useState<DoorInfo[]>([]);
  const [reservations, setReservations] = useState<ReservationInfo[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // Get person record linked to this user
      const { data: personData } = await supabase
        .from("funcionarios_clientes")
        .select("id, nome, cargo, tipo, company_id")
        .eq("user_id", user.id)
        .single();

      if (!personData) {
        setLoading(false);
        return;
      }
      setPerson(personData as PersonInfo);

      // Get company name
      const { data: company } = await supabase
        .from("companies")
        .select("name")
        .eq("id", personData.company_id)
        .single();
      if (company) setCompanyName(company.name);

      // Get assigned doors
      const { data: doorsData } = await supabase
        .from("locker_doors")
        .select("id, door_number, label, size, status, expires_at, occupied_at, locker_id")
        .eq("occupied_by_person", personData.id);

      if (doorsData && doorsData.length > 0) {
        // Get locker info for each door
        const lockerIds = [...new Set(doorsData.map(d => d.locker_id))];
        const { data: lockers } = await supabase
          .from("lockers")
          .select("id, name, location")
          .in("id", lockerIds);

        const lockersMap = new Map(lockers?.map(l => [l.id, l]) || []);
        const enriched = doorsData.map(d => ({
          ...d,
          locker: lockersMap.get(d.locker_id) || { name: "—", location: "—" },
        }));
        setDoors(enriched as DoorInfo[]);
      }

      // Get active reservations
      const { data: resData } = await supabase
        .from("locker_reservations")
        .select("id, starts_at, expires_at, status, usage_type, renewed_count")
        .eq("person_id", personData.id)
        .eq("status", "active")
        .order("starts_at", { ascending: false });
      if (resData) setReservations(resData as ReservationInfo[]);

      setLoading(false);
    };
    load();
  }, [user]);

  const displayName = person?.nome || user?.user_metadata?.full_name || "Usuário";
  const initials = displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  const sizeLabels: Record<string, string> = {
    small: "Pequena", medium: "Média", large: "Grande",
  };

  const isExpiringSoon = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    const diff = new Date(expiresAt).getTime() - Date.now();
    return diff > 0 && diff < 24 * 60 * 60 * 1000; // 24h
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-xs font-bold shadow-md shadow-primary/20">
              {initials}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-tight">{displayName}</p>
              <p className="text-[10px] text-muted-foreground">{companyName}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Greeting */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-xl font-bold text-foreground">
            Olá, {displayName.split(" ")[0]}! 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {doors.length > 0
              ? `Você possui ${doors.length} armário${doors.length > 1 ? "s" : ""} atribuído${doors.length > 1 ? "s" : ""}`
              : "Nenhum armário atribuído no momento"}
          </p>
        </motion.div>

        {/* Doors */}
        {doors.length > 0 ? (
          <div className="space-y-3">
            {doors.map((door, i) => (
              <motion.div
                key={door.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="shadow-card border-border/50 overflow-hidden">
                  <CardContent className="p-0">
                    {/* Door header */}
                    <div className="gradient-primary p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                          <Archive className="h-6 w-6 text-primary-foreground" />
                        </div>
                        <div>
                          <p className="text-primary-foreground font-bold text-lg">
                            Porta {door.label || door.door_number}
                          </p>
                          <p className="text-primary-foreground/70 text-xs">
                            {door.locker.name}
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-white/20 text-primary-foreground border-0 text-xs">
                        {sizeLabels[door.size] || door.size}
                      </Badge>
                    </div>

                    {/* Door details */}
                    <div className="p-4 space-y-3">
                      <div className="flex items-center gap-2.5 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-foreground">{door.locker.location || "Sem localização"}</span>
                      </div>

                      {door.occupied_at && (
                        <div className="flex items-center gap-2.5 text-sm">
                          <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="text-foreground">
                            Desde {format(new Date(door.occupied_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                      )}

                      {door.expires_at && (
                        <div className={`flex items-center gap-2.5 text-sm ${isExpiringSoon(door.expires_at) ? "text-orange-600" : ""}`}>
                          {isExpiringSoon(door.expires_at) ? (
                            <AlertCircle className="h-4 w-4 flex-shrink-0" />
                          ) : (
                            <KeyRound className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          )}
                          <span>
                            {isExpiringSoon(door.expires_at) ? "Expira em breve: " : "Válido até "}
                            {format(new Date(door.expires_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-2.5 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                        <span className="text-green-600 font-medium">Ativo</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="shadow-card border-border/50">
              <CardContent className="p-8 text-center">
                <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <Archive className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">Nenhum armário atribuído</h3>
                <p className="text-sm text-muted-foreground">
                  Quando um armário for atribuído a você, ele aparecerá aqui.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Active reservations */}
        {reservations.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Reservas Ativas
            </h2>
            <Card className="shadow-card border-border/50">
              <CardContent className="p-0 divide-y divide-border">
                {reservations.map((res) => (
                  <div key={res.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {res.usage_type === "temporary" ? "Temporária" : "Permanente"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Desde {format(new Date(res.starts_at), "dd/MM/yyyy", { locale: ptBR })}
                        {res.expires_at && ` • Até ${format(new Date(res.expires_at), "dd/MM/yyyy", { locale: ptBR })}`}
                      </p>
                    </div>
                    {res.renewed_count > 0 && (
                      <Badge variant="outline" className="text-[10px]">
                        {res.renewed_count}x renovada
                      </Badge>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Person info */}
        {person && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Seus Dados
            </h2>
            <Card className="shadow-card border-border/50">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Nome</p>
                    <p className="text-sm font-medium text-foreground">{person.nome}</p>
                  </div>
                </div>
                {person.cargo && (
                  <>
                    <Separator />
                    <div className="flex items-center gap-3">
                      <KeyRound className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Cargo</p>
                        <p className="text-sm font-medium text-foreground">{person.cargo}</p>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
