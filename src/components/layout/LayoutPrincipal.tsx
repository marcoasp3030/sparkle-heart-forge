import { useState, ReactNode } from "react";
import { Menu, Building2, Sun, Moon } from "lucide-react";
import { useCompanyBranding } from "@/hooks/useCompanyBranding";
import { useSessionTimeout } from "@/hooks/useSessionTimeout";
import { useTheme } from "next-themes";
import { useCompany } from "@/contexts/ContextoEmpresa";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import SidebarContent from "./SidebarContent";
import SinoNotificacoes from "./SinoNotificacoes";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

export default function AppLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { selectedCompany } = useCompany();
  const { theme, setTheme } = useTheme();
  const isMobile = useIsMobile();
  useCompanyBranding();
  useSessionTimeout();

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile sidebar via Sheet */}
      {isMobile && (
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-72 p-0 bg-sidebar border-none">
            <VisuallyHidden><SheetTitle>Menu de navegação</SheetTitle></VisuallyHidden>
            <div className="flex flex-col h-full">
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Desktop sidebar */}
      {!isMobile && (
        <aside className={`${sidebarOpen ? "w-72" : "w-[72px]"} fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar transition-all duration-300 ease-in-out overflow-hidden`}>
          <SidebarContent collapsed={!sidebarOpen} />
        </aside>
      )}

      {/* Main content */}
      <div className={`flex-1 ${!isMobile ? (sidebarOpen ? "ml-72" : "ml-[72px]") : ""} transition-all duration-300`}>
        <header className="sticky top-0 z-40 h-14 md:h-16 border-b border-border bg-background/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => isMobile ? setMobileOpen(true) : setSidebarOpen(!sidebarOpen)}
              className="h-9 w-9"
            >
              <Menu className="h-4 w-4" />
            </Button>
            {selectedCompany && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4 hidden sm:block" />
                <span className="font-medium text-foreground text-xs sm:text-sm truncate max-w-[150px] sm:max-w-none">{selectedCompany.name}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title={theme === "dark" ? "Modo claro" : "Modo escuro"}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <SinoNotificacoes />
          </div>
        </header>
        <main className="p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
