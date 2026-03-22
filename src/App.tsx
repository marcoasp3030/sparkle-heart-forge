import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/ContextoAutenticacao";
import { CompanyProvider } from "@/contexts/ContextoEmpresa";
import { PlatformProvider } from "@/contexts/ContextoPlataforma";
import RotaProtegida from "@/components/RotaProtegida";
import TransicaoPagina from "@/components/TransicaoPagina";
import LayoutPrincipal from "@/components/layout/LayoutPrincipal";
import PainelDeControle from "./pages/PainelDeControle";
import Autenticacao from "./pages/Autenticacao";
import Administracao from "./pages/Administracao";
import Personalizacao from "./pages/Personalizacao";
import Armarios from "./pages/Armarios";
import Empresas from "./pages/Empresas";
import Departamentos from "./pages/Departamentos";
import Setores from "./pages/Setores";
import Pessoas from "./pages/Pessoas";

import Configuracoes from "./pages/Configuracoes";
import HistoricoPortas from "./pages/HistoricoPortas";
import Renovacoes from "./pages/Renovacoes";
import Auditoria from "./pages/Auditoria";
import Portal from "./pages/Portal";
import StatusConexao from "./pages/StatusConexao";
import NaoEncontrada from "./pages/NaoEncontrada";
import RedefinirSenha from "./pages/RedefinirSenha";
import Changelog from "./pages/Changelog";
import LogsFechaduras from "./pages/LogsFechaduras";

const queryClient = new QueryClient();

function RotasAnimadas() {
  const location = useLocation();

  const protectedRoute = (element: React.ReactNode) => (
    <RotaProtegida>
      <LayoutPrincipal>
        <TransicaoPagina>{element}</TransicaoPagina>
      </LayoutPrincipal>
    </RotaProtegida>
  );

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/auth" element={<TransicaoPagina><Autenticacao /></TransicaoPagina>} />
        <Route path="/reset-password" element={<TransicaoPagina><RedefinirSenha /></TransicaoPagina>} />
        <Route path="/changelog" element={<TransicaoPagina><Changelog /></TransicaoPagina>} />
        <Route path="/portal" element={<RotaProtegida><TransicaoPagina><Portal /></TransicaoPagina></RotaProtegida>} />
        <Route path="/" element={protectedRoute(<PainelDeControle />)} />
        <Route path="/armarios" element={protectedRoute(<Armarios />)} />
        <Route path="/historico" element={protectedRoute(<HistoricoPortas />)} />
        <Route path="/renovacoes" element={protectedRoute(<Renovacoes />)} />
        <Route path="/auditoria" element={protectedRoute(<Auditoria />)} />
        <Route path="/logs-fechaduras" element={protectedRoute(<LogsFechaduras />)} />
        <Route path="/empresas" element={protectedRoute(<Empresas />)} />
        <Route path="/departamentos" element={protectedRoute(<Departamentos />)} />
        <Route path="/setores" element={protectedRoute(<Setores />)} />
        <Route path="/pessoas" element={protectedRoute(<Pessoas />)} />
        <Route path="/admin" element={protectedRoute(<Administracao />)} />
        <Route path="/personalizacao" element={protectedRoute(<Personalizacao />)} />
        
        <Route path="/status" element={protectedRoute(<StatusConexao />)} />
        <Route path="/configuracoes" element={protectedRoute(<Configuracoes />)} />
        <Route path="*" element={<TransicaoPagina><NaoEncontrada /></TransicaoPagina>} />
      </Routes>
    </AnimatePresence>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <PlatformProvider>
        <AuthProvider>
          <CompanyProvider>
            <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <RotasAnimadas />
            </BrowserRouter>
            </TooltipProvider>
          </CompanyProvider>
        </AuthProvider>
      </PlatformProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
