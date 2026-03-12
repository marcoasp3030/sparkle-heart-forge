import { useEffect } from "react";
import { supabase } from "@/lib/supabase-compat";
import { useAuth } from "@/contexts/ContextoAutenticacao";
import { useCompany } from "@/contexts/ContextoEmpresa";
import { usePlatform, CompanyBranding } from "@/contexts/ContextoPlataforma";

export function useCompanyBranding() {
  const { user } = useAuth();
  const { selectedCompany, isSuperAdmin, hasPermission } = useCompany();
  const { setCompanyBranding } = usePlatform();

  useEffect(() => {
    if (!user) return;

    const loadBranding = async () => {
      // For superadmin viewing all companies, don't apply company branding
      if (isSuperAdmin && !selectedCompany) {
        setCompanyBranding(null);
        return;
      }

      // Get the company to load branding for
      let companyId: string | null = null;

      if (isSuperAdmin && selectedCompany) {
        companyId = selectedCompany.id;
      } else {
        // Regular user: use their company
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("user_id", user.id)
          .single();
        companyId = profile?.company_id || null;
      }

      if (!companyId) {
        setCompanyBranding(null);
        return;
      }

      // Check if company has white_label permission
      const { data: perms } = await supabase
        .from("company_permissions")
        .select("enabled")
        .eq("company_id", companyId)
        .eq("permission", "white_label")
        .single();

      if (!perms?.enabled) {
        setCompanyBranding(null);
        return;
      }

      // Load company branding
      const { data } = await supabase
        .from("company_branding")
        .select("*")
        .eq("company_id", companyId)
        .single();

      if (data) {
        setCompanyBranding(data as unknown as CompanyBranding);
      } else {
        setCompanyBranding(null);
      }
    };

    loadBranding();
  }, [user, selectedCompany, isSuperAdmin]);
}
