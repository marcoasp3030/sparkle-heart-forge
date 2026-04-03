import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Bell, CheckCircle2, RefreshCw, AlertCircle, Archive, Clock } from "lucide-react";
import api from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
}

interface NotificacoesPortalProps {
  userId: string;
  onUnreadCountChange?: (count: number) => void;
}

const typeIcons: Record<string, React.ReactNode> = {
  renewal_request: <RefreshCw className="h-4 w-4 text-accent" />,
  renewal_approved: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  renewal_rejected: <AlertCircle className="h-4 w-4 text-destructive" />,
  expiry_warning: <Clock className="h-4 w-4 text-accent" />,
  locker_assigned: <Archive className="h-4 w-4 text-primary" />,
  info: <Bell className="h-4 w-4 text-muted-foreground" />,
};

export default function NotificacoesPortal({ userId, onUnreadCountChange }: NotificacoesPortalProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const res = await api.get("/mobile/notificacoes");
      const data = res.data?.data || [];
      const unread = res.data?.unread_count || 0;
      setNotifications(data as Notification[]);
      onUnreadCountChange?.(unread);
    } catch {
      // silent
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  const markAsRead = async (id: string) => {
    try {
      await api.put(`/mobile/notificacoes/${id}/lida`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      onUnreadCountChange?.(notifications.filter(n => !n.read && n.id !== id).length);
    } catch {
      // silent
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;
    try {
      await api.put("/mobile/notificacoes/ler-todas");
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      onUnreadCountChange?.(0);
    } catch {
      // silent
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {unreadCount > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-primary">{unreadCount}</span> não lida{unreadCount !== 1 ? "s" : ""}
          </p>
          <Button variant="ghost" size="sm" className="text-xs gap-1.5" onClick={markAllAsRead}>
            <CheckCircle2 className="h-3 w-3" />
            Marcar todas como lidas
          </Button>
        </div>
      )}

      {notifications.length > 0 ? (
        <Card className="shadow-card border-border/50">
          <CardContent className="p-0 divide-y divide-border">
            {notifications.map((notif, i) => (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className={`p-4 flex items-start gap-3 cursor-pointer transition-colors hover:bg-muted/30 ${
                  !notif.read ? "bg-primary/5" : ""
                }`}
                onClick={() => !notif.read && markAsRead(notif.id)}
              >
                <div className="mt-0.5 flex-shrink-0">
                  {typeIcons[notif.type] || typeIcons.info}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-medium truncate ${!notif.read ? "text-foreground" : "text-muted-foreground"}`}>
                      {notif.title}
                    </p>
                    {!notif.read && (
                      <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-1">
                    {formatDistanceToNow(new Date(notif.created_at), { locale: ptBR, addSuffix: true })}
                  </p>
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-card border-border/50">
          <CardContent className="p-10 text-center">
            <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Bell className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">Sem notificações</h3>
            <p className="text-sm text-muted-foreground">
              Quando houver novidades, elas aparecerão aqui.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
