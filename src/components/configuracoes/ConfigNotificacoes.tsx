import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Bell, Archive, Shield, Users, AlertTriangle, Volume2, VolumeX } from "lucide-react";
import { getSoundEnabled, setSoundEnabled, useFeedbackSonoro } from "@/hooks/useFeedbackSonoro";

interface NotifPrefs {
  locker_events: boolean;
  security_alerts: boolean;
  user_management: boolean;
  system_updates: boolean;
}

const defaultPrefs: NotifPrefs = {
  locker_events: true,
  security_alerts: true,
  user_management: true,
  system_updates: true,
};

export default function ConfigNotificacoes() {
  const [prefs, setPrefs] = useState<NotifPrefs>(() => {
    const saved = localStorage.getItem("notification_prefs");
    return saved ? { ...defaultPrefs, ...JSON.parse(saved) } : defaultPrefs;
  });
  const [soundOn, setSoundOn] = useState(getSoundEnabled);
  const { play } = useFeedbackSonoro();

  useEffect(() => {
    localStorage.setItem("notification_prefs", JSON.stringify(prefs));
  }, [prefs]);

  const toggle = (key: keyof NotifPrefs) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSoundToggle = (checked: boolean) => {
    setSoundOn(checked);
    setSoundEnabled(checked);
    if (checked) {
      play("reserve"); // preview sound when enabling
    }
  };

  const categories = [
    {
      key: "locker_events" as const,
      icon: Archive,
      title: "Eventos de armários",
      description: "Reservas, liberações e alterações de status das portas",
    },
    {
      key: "security_alerts" as const,
      icon: Shield,
      title: "Alertas de segurança",
      description: "Tentativas de login suspeitas e bloqueios de conta",
    },
    {
      key: "user_management" as const,
      icon: Users,
      title: "Gestão de usuários",
      description: "Novos cadastros, alterações de perfil e permissões",
    },
    {
      key: "system_updates" as const,
      icon: AlertTriangle,
      title: "Atualizações do sistema",
      description: "Manutenções programadas e atualizações da plataforma",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Sound feedback card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {soundOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            Feedback Sonoro
          </CardTitle>
          <CardDescription>
            Sons sutis ao realizar ações como reservar, liberar ou renovar portas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="sound_feedback" className="text-sm font-medium cursor-pointer">
                Ativar sons de feedback
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                {soundOn ? "Sons ativados — você ouvirá um som ao confirmar ações" : "Sons desativados"}
              </p>
            </div>
            <Switch
              id="sound_feedback"
              checked={soundOn}
              onCheckedChange={handleSoundToggle}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notification preferences card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Preferências de Notificações
          </CardTitle>
          <CardDescription>
            Escolha quais tipos de notificações deseja receber
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {categories.map((cat, i) => (
            <div key={cat.key}>
              <div className="flex items-center justify-between py-4">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center mt-0.5">
                    <cat.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <Label htmlFor={cat.key} className="text-sm font-medium cursor-pointer">
                      {cat.title}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
                  </div>
                </div>
                <Switch
                  id={cat.key}
                  checked={prefs[cat.key]}
                  onCheckedChange={() => toggle(cat.key)}
                />
              </div>
              {i < categories.length - 1 && <Separator />}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
