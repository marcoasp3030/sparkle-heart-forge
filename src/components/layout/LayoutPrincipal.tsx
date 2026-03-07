import { useState, ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Settings, Bell,
  LogOut, Shield, LayoutDashboard, Archive,
  Building, Layers, Users, ChevronDown, Menu, Building2, ChevronsUpDown
} from "lucide-react";
import { useAuth } from "@/contexts/ContextoAutenticacao";
import { useCompany } from "@/contexts/ContextoEmpresa";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Archive, label: "Armários", path: "/armarios", permission: "manage_lockers" },
  { icon: Building, label: "Departamentos", path: "/departamentos" },
  { icon: Layers, label: "Setores", path: "/setores" },
  { icon: Users, label: "Pessoas", path: "/pessoas", permission: "manage_employees" },
  { icon: Settings, label: "Configurações", path: "/configuracoes" },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user, signOut } = useAuth();
  const { companies, selectedCompany, setSelectedCompany, isSuperAdmin, userRole } = useCompany();
  const navigate = useNavigate();
  const location = useLocation();

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuário";
  const initials = displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-72" : "w-[72px]"} fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar transition-all duration-300 ease-in-out overflow-hidden`}>
        {/* Logo area */}
        <div className="relative flex h-20 items-center gap-3 px-5">
          <div className="absolute bottom-0 left-5 right-5 h-px bg-gradient-to-r from-primary/40 via-primary/20 to-transparent" />
          <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/20 flex-shrink-0">
            <img src={lockerLogo} alt="PB One Locker" className="h-6 w-6 object-contain brightness-0 invert" />
          </div>
          {sidebarOpen && (
            <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
              <span className="text-sidebar-primary-foreground font-extrabold text-base tracking-tight">PB One</span>
              <span className="block text-[10px] font-medium text-sidebar-foreground/60 uppercase tracking-[0.2em] -mt-0.5">Locker System</span>
            </motion.div>
          )}
        </div>

        {/* Company Selector (superadmin only) */}
        {isSuperAdmin && sidebarOpen && companies.length > 0 && (
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

        {sidebarOpen && (
          <div className="px-5 pt-5 pb-2">
            <span className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-[0.15em]">Menu Principal</span>
          </div>
        )}

        <nav className="flex-1 py-2 px-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative ${
                  isActive
                    ? "gradient-primary text-primary-foreground shadow-md shadow-primary/25"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <item.icon className={`h-[18px] w-[18px] flex-shrink-0 transition-transform duration-200 ${!isActive ? "group-hover:scale-110" : ""}`} />
                {sidebarOpen && (
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
                    {item.label}
                  </motion.span>
                )}
                {isActive && !sidebarOpen && (
                  <div className="absolute -right-px top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-l-full bg-primary" />
                )}
              </button>
            );
          })}

          {isSuperAdmin && (
            <>
              {sidebarOpen && (
                <div className="px-2 pt-5 pb-2">
                  <span className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-[0.15em]">Administração</span>
                </div>
              )}
              {!sidebarOpen && <div className="my-3 mx-2 h-px bg-sidebar-border" />}
              <button
                onClick={() => navigate("/empresas")}
                className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  location.pathname === "/empresas"
                    ? "gradient-primary text-primary-foreground shadow-md shadow-primary/25"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Building2 className="h-[18px] w-[18px] flex-shrink-0 group-hover:scale-110 transition-transform duration-200" />
                {sidebarOpen && <span>Empresas</span>}
              </button>
              <button
                onClick={() => navigate("/admin")}
                className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  location.pathname === "/admin"
                    ? "gradient-primary text-primary-foreground shadow-md shadow-primary/25"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Shield className="h-[18px] w-[18px] flex-shrink-0 group-hover:scale-110 transition-transform duration-200" />
                {sidebarOpen && <span>Gerenciar Usuários</span>}
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
                {sidebarOpen && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 text-left min-w-0">
                    <p className="text-[13px] font-semibold text-sidebar-accent-foreground truncate">{displayName}</p>
                    <p className="text-[10px] text-sidebar-foreground/50 truncate">{user?.email}</p>
                  </motion.div>
                )}
                {sidebarOpen && <ChevronDown className="h-3.5 w-3.5 text-sidebar-foreground/40 flex-shrink-0" />}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 rounded-xl p-1">
              <DropdownMenuItem className="rounded-lg py-2 text-sm">Meu Perfil</DropdownMenuItem>
              <DropdownMenuItem className="rounded-lg py-2 text-sm">Preferências</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="rounded-lg py-2 text-sm text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main content */}
      <div className={`flex-1 ${sidebarOpen ? "ml-72" : "ml-[72px]"} transition-all duration-300`}>
        <header className="sticky top-0 z-40 h-16 border-b border-border bg-background/80 backdrop-blur-xl flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="h-9 w-9">
              <Menu className="h-4 w-4" />
            </Button>
            {selectedCompany && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span className="font-medium text-foreground">{selectedCompany.name}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative h-9 w-9">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
            </Button>
          </div>
        </header>
        <main className="p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
