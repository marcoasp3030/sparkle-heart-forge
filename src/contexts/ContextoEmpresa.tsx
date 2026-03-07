import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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

  const fetchCompanies = async () => {
    const { data } = await supabase.from("companies").select("*").eq("active", true).order("name");
    if (data) {
      setCompanies(data);
      // Auto-select first if none selected
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
      // Get user profile
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
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
};
