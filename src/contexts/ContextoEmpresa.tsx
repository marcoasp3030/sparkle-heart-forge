import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/ContextoAutenticacao";

interface Company {
  id: string;
  name: string;
  type: string;
  description: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface CompanyContextType {
  companies: Company[];
  selectedCompany: Company | null;
  setSelectedCompany: (company: Company | null) => void;
  loading: boolean;
  isSuperAdmin: boolean;
  userRole: string | null;
  userCompanyId: string | null;
  refreshCompanies: () => Promise<void>;
  companyPermissions: Record<string, boolean>;
  hasPermission: (permission: string) => boolean;
}

const CompanyContext = createContext<CompanyContextType>({
  companies: [],
  selectedCompany: null,
  setSelectedCompany: () => {},
  loading: true,
  isSuperAdmin: false,
  userRole: null,
  userCompanyId: null,
  refreshCompanies: async () => {},
  companyPermissions: {},
  hasPermission: () => false,
});

export const useCompany = () => useContext(CompanyContext);

export const CompanyProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userCompanyId, setUserCompanyId] = useState<string | null>(null);
  const [companyPermissions, setCompanyPermissions] = useState<Record<string, boolean>>({});

  const fetchPermissions = async (companyId: string) => {
    const { data } = await supabase
      .from("company_permissions")
      .select("permission, enabled")
      .eq("company_id", companyId);

    const perms: Record<string, boolean> = {};
    if (data) {
      data.forEach((row: any) => { perms[row.permission] = row.enabled; });
    }
    setCompanyPermissions(perms);
  };

  const hasPermission = (permission: string): boolean => {
    if (isSuperAdmin) return true;
    return companyPermissions[permission] === true;
  };

  const fetchCompanies = async () => {
    const { data } = await supabase.from("companies").select("*").eq("active", true).order("name");
    if (data) {
      setCompanies(data);
      if (!selectedCompany && data.length > 0) {
        setSelectedCompany(data[0]);
      }
    }
  };

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const init = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, company_id")
        .eq("user_id", user.id)
        .single();

      const role = profile?.role || "user";
      setUserRole(role);
      setIsSuperAdmin(role === "superadmin");
      setUserCompanyId(profile?.company_id || null);

      await fetchCompanies();
      setLoading(false);
    };

    init();
  }, [user]);

  // Fetch permissions when selected company changes
  useEffect(() => {
    if (selectedCompany) {
      fetchPermissions(selectedCompany.id);
    } else {
      setCompanyPermissions({});
    }
  }, [selectedCompany]);

  // If non-superadmin, lock to their company
  useEffect(() => {
    if (!isSuperAdmin && userCompanyId && companies.length > 0) {
      const userCompany = companies.find((c) => c.id === userCompanyId);
      if (userCompany) setSelectedCompany(userCompany);
    }
  }, [isSuperAdmin, userCompanyId, companies]);

  return (
    <CompanyContext.Provider
      value={{
        companies,
        selectedCompany,
        setSelectedCompany,
        loading,
        isSuperAdmin,
        userRole,
        userCompanyId,
        refreshCompanies: fetchCompanies,
        companyPermissions,
        hasPermission,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
};
