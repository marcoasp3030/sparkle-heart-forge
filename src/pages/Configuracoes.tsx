import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/ContextoAutenticacao";
import { useCompany } from "@/contexts/ContextoEmpresa";
import ConfigPerfil from "@/components/configuracoes/ConfigPerfil";
import ConfigSeguranca from "@/components/configuracoes/ConfigSeguranca";
import ConfigNotificacoes from "@/components/configuracoes/ConfigNotificacoes";
import ConfigSistema from "@/components/configuracoes/ConfigSistema";
import ConfigEmail from "@/components/configuracoes/ConfigEmail";
import ConfigUazapi from "@/components/configuracoes/ConfigUazapi";
import { User, Shield, Bell, Monitor, Mail, MessageSquare } from "lucide-react";

export default function Configuracoes() {
  const { user } = useAuth();
  const { isSuperAdmin, userRole } = useCompany();
  const isAdmin = userRole === "admin" || isSuperAdmin;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie suas preferências e configurações do sistema
        </p>
      </div>

      <Tabs defaultValue="perfil" className="space-y-6">
        <TabsList className="bg-muted/50 p-1 rounded-xl h-auto flex-wrap">
          <TabsTrigger value="perfil" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2 text-sm">
            <User className="h-4 w-4" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="seguranca" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2 text-sm">
            <Shield className="h-4 w-4" />
            Segurança
          </TabsTrigger>
          <TabsTrigger value="notificacoes" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2 text-sm">
            <Bell className="h-4 w-4" />
            Notificações
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="email" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2 text-sm">
              <Mail className="h-4 w-4" />
              E-mail
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="email" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2 text-sm">
              <Mail className="h-4 w-4" />
              E-mail
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="whatsapp" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2 text-sm">
              <MessageSquare className="h-4 w-4" />
              WhatsApp
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="sistema" className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2 text-sm">
              <Monitor className="h-4 w-4" />
              Sistema
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="perfil">
          <ConfigPerfil />
        </TabsContent>
        <TabsContent value="seguranca">
          <ConfigSeguranca />
        </TabsContent>
        <TabsContent value="notificacoes">
          <ConfigNotificacoes />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="email">
            <ConfigEmail />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="email">
            <ConfigEmail />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="whatsapp">
            <ConfigUazapi />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="sistema">
            <ConfigSistema />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
