import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AuthProvider } from "@/contexts/ContextoAutenticacao";
import { CompanyProvider } from "@/contexts/ContextoEmpresa";
import RotaProtegida from "@/components/RotaProtegida";
import TransicaoPagina from "@/components/TransicaoPagina";
import LayoutPrincipal from "@/components/layout/LayoutPrincipal";
import PainelDeControle from "./pages/PainelDeControle";
import Autenticacao from "./pages/Autenticacao";
import Administracao from "./pages/Administracao";
import Armarios from "./pages/Armarios";
import Empresas from "./pages/Empresas";
import NaoEncontrada from "./pages/NaoEncontrada";

const queryClient = new QueryClient();

function RotasAnimadas() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/auth" element={<TransicaoPagina><Autenticacao /></TransicaoPagina>} />
        <Route
          path="/"
          element={
            <RotaProtegida>
              <LayoutPrincipal>
                <TransicaoPagina><PainelDeControle /></TransicaoPagina>
              </LayoutPrincipal>
            </RotaProtegida>
          }
        />
        <Route
          path="/lockers"
          element={
            <RotaProtegida>
              <LayoutPrincipal>
                <TransicaoPagina><Armarios /></TransicaoPagina>
              </LayoutPrincipal>
            </RotaProtegida>
          }
        />
        <Route
          path="/companies"
          element={
            <RotaProtegida>
              <LayoutPrincipal>
                <TransicaoPagina><Empresas /></TransicaoPagina>
              </LayoutPrincipal>
            </RotaProtegida>
          }
        />
        <Route
          path="/admin"
          element={
            <RotaProtegida>
              <LayoutPrincipal>
                <TransicaoPagina><Administracao /></TransicaoPagina>
              </LayoutPrincipal>
            </RotaProtegida>
          }
        />
        <Route path="*" element={<TransicaoPagina><NaoEncontrada /></TransicaoPagina>} />
      </Routes>
    </AnimatePresence>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
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
  </QueryClientProvider>
);

export default App;
