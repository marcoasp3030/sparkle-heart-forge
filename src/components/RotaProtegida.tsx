import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/ContextoAutenticacao";
import { useCompany } from "@/contexts/ContextoEmpresa";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();
  const { userRole, loading: companyLoading } = useCompany();
  const location = useLocation();

  if (loading || companyLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  // Users with role 'user' can only access /portal
  if (userRole === "user" && location.pathname !== "/portal") {
    return <Navigate to="/portal" replace />;
  }

  // Admins/superadmins accessing /portal should go to dashboard
  if (userRole !== "user" && location.pathname === "/portal") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
