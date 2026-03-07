
-- Create companies table
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'employee' CHECK (type IN ('employee', 'rental')),
  description TEXT DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add company_id to profiles
ALTER TABLE public.profiles ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

-- Add company_id to lockers
ALTER TABLE public.lockers ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- Enable RLS on companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Superadmins can do everything with companies
CREATE POLICY "Superadmins can manage companies"
  ON public.companies FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'superadmin')
  WITH CHECK (get_user_role(auth.uid()) = 'superadmin');

-- Admins can view their own company
CREATE POLICY "Users can view their company"
  ON public.companies FOR SELECT TO authenticated
  USING (id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid()));

-- Update lockers RLS: admins can only manage lockers in their company
DROP POLICY IF EXISTS "Admins can manage lockers" ON public.lockers;
CREATE POLICY "Admins can manage lockers"
  ON public.lockers FOR ALL TO authenticated
  USING (
    get_user_role(auth.uid()) = 'superadmin'
    OR (
      get_user_role(auth.uid()) = 'admin'
      AND company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    get_user_role(auth.uid()) = 'superadmin'
    OR (
      get_user_role(auth.uid()) = 'admin'
      AND company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

-- Update lockers view policy for tenant isolation
DROP POLICY IF EXISTS "Authenticated users can view lockers" ON public.lockers;
CREATE POLICY "Users can view lockers in their company"
  ON public.lockers FOR SELECT TO authenticated
  USING (
    get_user_role(auth.uid()) = 'superadmin'
    OR company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
  );

-- Update lockers delete policy
DROP POLICY IF EXISTS "Admins can delete lockers" ON public.lockers;
CREATE POLICY "Admins can delete lockers"
  ON public.lockers FOR DELETE TO authenticated
  USING (
    get_user_role(auth.uid()) = 'superadmin'
    OR (
      get_user_role(auth.uid()) = 'admin'
      AND company_id IN (SELECT company_id FROM public.profiles WHERE user_id = auth.uid())
    )
  );

-- Update updated_at trigger for companies
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
