import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Settings, LogOut, Shield, LayoutDashboard, Archive, History,
  Building, Layers, Users, ChevronDown, Building2, ChevronsUpDown, Palette, Brush, RefreshCw, ShieldCheck, Activity, Unlock
} from "lucide-react";
import { useAuth } from "@/contexts/ContextoAutenticacao";
import { useCompany } from "@/contexts/ContextoEmpresa";
import { usePlatform } from "@/contexts/ContextoPlataforma";
import { useNavigate, useLocation } from "react-router-dom";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import lockerLogo from "@/assets/locker-logo.png";

interface NavItem {
  icon: any;
  label: string;
  path: string;
  permission?: string;
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/", permission: "view_dashboard" },
  { icon: Archive, label: "Armários", path: "/armarios", permission: "manage_lockers" },
  { icon: History, label: "Histórico", path: "/historico", permission: "view_history" },
  { icon: RefreshCw, label: "Renovações", path: "/renovacoes", permission: "manage_renewals" },
  { icon: ShieldCheck, label: "Auditoria", path: "/auditoria", permission: "view_audit" },
  { icon: Building, label: "Departamentos", path: "/departamentos", permission: "manage_departments" },
  { icon: Layers, label: "Setores", path: "/setores", permission: "manage_sectors" },
  { icon: Users, label: "Pessoas", path: "/pessoas", permission: "manage_employees" },
  { icon: Settings, label: "Configurações", path: "/configuracoes" },
];

interface SidebarContentProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

export default function SidebarContent({ collapsed = false, onNavigate }: SidebarContentProps) {
  const { user, signOut } = useAuth();
  const { companies, selectedCompany, setSelectedCompany, isSuperAdmin, hasPermission } = useCompany();
  const { settings, effectiveSettings } = usePlatform();
  const navigate = useNavigate();
  const location = useLocation();

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuário";
  const initials = displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);
  const expanded = !collapsed;

  const handleNav = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  return (
    <>
      {/* Logo area */}
      <div className="relative flex h-20 items-center gap-3 px-5">
        <div className="absolute bottom-0 left-5 right-5 h-px bg-gradient-to-r from-primary/40 via-primary/20 to-transparent" />
        <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/20 flex-shrink-0">
          <img src={effectiveSettings.images.sidebar_logo_url || effectiveSettings.images.logo_url || lockerLogo} alt="Logo" className="h-6 w-6 object-contain brightness-0 invert" />
        </div>
        {expanded && (
          <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
            <span className="text-sidebar-primary-foreground font-extrabold text-base tracking-tight">PB One</span>
            <span className="block text-[10px] font-medium text-sidebar-foreground/60 uppercase tracking-[0.2em] -mt-0.5">{effectiveSettings.branding.platform_name || "Locker System"}</span>
          </motion.div>
        )}
      </div>

      {/* Company Selector (superadmin only) */}
      {isSuperAdmin && expanded && companies.length > 0 && (
        <div className="px-3 pt-4 pb-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-sidebar-accent/60 hover:bg-sidebar-accent transition-colors text-left">
                <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-sidebar-accent-foreground truncate">
                    {selectedCompany?.name || "Selecionar empresa"}
                  </p>
                  <p className="text-[10px] text-sidebar-foreground/50 truncate">
                    {selectedCompany?.type === "employee" ? "Funcionários" : selectedCompany?.type === "rental" ? "Aluguel" : ""}
                  </p>
                </div>
                <ChevronsUpDown className="h-3.5 w-3.5 text-sidebar-foreground/40 flex-shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 rounded-xl p-1">
              {companies.map((c) => (
                <DropdownMenuItem
                  key={c.id}
                  onClick={() => setSelectedCompany(c)}
                  className={`rounded-lg py-2 text-sm ${selectedCompany?.id === c.id ? "bg-primary/10 text-primary" : ""}`}
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  {c.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSelectedCompany(null)} className="rounded-lg py-2 text-sm text-muted-foreground">
                Todas as empresas
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {expanded && (
        <div className="px-5 pt-5 pb-2">
          <span className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-[0.15em]">Menu Principal</span>
        </div>
      )}

      <nav className="flex-1 py-2 px-3 space-y-0.5 overflow-y-auto">
        {navItems.filter((item) => !item.permission || hasPermission(item.permission)).map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.label}
              onClick={() => handleNav(item.path)}
              className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative ${
                isActive
                  ? "gradient-primary text-primary-foreground shadow-md shadow-primary/25"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <item.icon className={`h-[18px] w-[18px] flex-shrink-0 transition-transform duration-200 ${!isActive ? "group-hover:scale-110" : ""}`} />
              {expanded && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
                  {item.label}
                </motion.span>
              )}
              {isActive && !expanded && (
                <div className="absolute -right-px top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-l-full bg-primary" />
              )}
            </button>
          );
        })}

        {isSuperAdmin && (
          <>
            {expanded && (
              <div className="px-2 pt-5 pb-2">
                <span className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-[0.15em]">Administração</span>
              </div>
            )}
            {!expanded && <div className="my-3 mx-2 h-px bg-sidebar-border" />}
            <button
              onClick={() => handleNav("/empresas")}
              className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                location.pathname === "/empresas"
                  ? "gradient-primary text-primary-foreground shadow-md shadow-primary/25"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Building2 className="h-[18px] w-[18px] flex-shrink-0 group-hover:scale-110 transition-transform duration-200" />
              {expanded && <span>Empresas</span>}
            </button>
            <button
              onClick={() => handleNav("/admin")}
              className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                location.pathname === "/admin"
                  ? "gradient-primary text-primary-foreground shadow-md shadow-primary/25"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Shield className="h-[18px] w-[18px] flex-shrink-0 group-hover:scale-110 transition-transform duration-200" />
              {expanded && <span>Gerenciar Usuários</span>}
            </button>
            <button
              onClick={() => handleNav("/personalizacao")}
              className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                location.pathname === "/personalizacao"
                  ? "gradient-primary text-primary-foreground shadow-md shadow-primary/25"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Palette className="h-[18px] w-[18px] flex-shrink-0 group-hover:scale-110 transition-transform duration-200" />
              {expanded && <span>Personalização</span>}
            </button>
            <button
              onClick={() => handleNav("/logs-fechaduras")}
              className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                location.pathname === "/logs-fechaduras"
                  ? "gradient-primary text-primary-foreground shadow-md shadow-primary/25"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Unlock className="h-[18px] w-[18px] flex-shrink-0 group-hover:scale-110 transition-transform duration-200" />
              {expanded && <span>Logs Fechaduras</span>}
            </button>
            <button
              onClick={() => handleNav("/status")}
              className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                location.pathname === "/status"
                  ? "gradient-primary text-primary-foreground shadow-md shadow-primary/25"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Activity className="h-[18px] w-[18px] flex-shrink-0 group-hover:scale-110 transition-transform duration-200" />
              {expanded && <span>Status Conexão</span>}
            </button>
          </>
        )}
      </nav>

      {/* User section */}
      <div className="p-3">
        <div className="relative">
          <div className="absolute top-0 left-3 right-3 h-px bg-gradient-to-r from-transparent via-sidebar-border to-transparent" />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-sidebar-accent/60 transition-all duration-200 mt-2">
              <div className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground text-xs font-bold flex-shrink-0 shadow-md shadow-primary/20">
                {initials}
              </div>
              {expanded && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 text-left min-w-0">
                  <p className="text-[13px] font-semibold text-sidebar-accent-foreground truncate">{displayName}</p>
                  <p className="text-[10px] text-sidebar-foreground/50 truncate">{user?.email}</p>
                </motion.div>
              )}
              {expanded && <ChevronDown className="h-3.5 w-3.5 text-sidebar-foreground/40 flex-shrink-0" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 rounded-xl p-1">
            <DropdownMenuItem onClick={() => handleNav("/configuracoes")} className="rounded-lg py-2 text-sm">Meu Perfil</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNav("/configuracoes")} className="rounded-lg py-2 text-sm">Preferências</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="rounded-lg py-2 text-sm text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
}
