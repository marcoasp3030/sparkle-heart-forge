
-- Table to store per-company feature permissions
CREATE TABLE public.company_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  permission text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(company_id, permission)
);

-- Enable RLS
ALTER TABLE public.company_permissions ENABLE ROW LEVEL SECURITY;

-- Superadmins can manage all permissions
CREATE POLICY "Superadmins manage all company_permissions"
  ON public.company_permissions FOR ALL
  TO authenticated
  USING (get_user_role(auth.uid()) = 'superadmin')
  WITH CHECK (get_user_role(auth.uid()) = 'superadmin');

-- Admins can view their company permissions
CREATE POLICY "Admins view own company permissions"
  ON public.company_permissions FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT p.company_id FROM profiles p WHERE p.user_id = auth.uid()
    )
  );

-- Users can view their company permissions
CREATE POLICY "Users view own company permissions"
  ON public.company_permissions FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT p.company_id FROM profiles p WHERE p.user_id = auth.uid()
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_company_permissions_updated_at
  BEFORE UPDATE ON public.company_permissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default permissions for existing companies
INSERT INTO public.company_permissions (company_id, permission, enabled)
SELECT id, 'manage_employees', true FROM public.companies
ON CONFLICT DO NOTHING;

INSERT INTO public.company_permissions (company_id, permission, enabled)
SELECT id, 'manage_lockers', true FROM public.companies
ON CONFLICT DO NOTHING;
