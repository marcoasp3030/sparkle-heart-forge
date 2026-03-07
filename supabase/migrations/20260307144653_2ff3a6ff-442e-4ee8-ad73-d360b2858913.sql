
CREATE TABLE public.company_branding (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  logo_url text DEFAULT '',
  sidebar_logo_url text DEFAULT '',
  favicon_url text DEFAULT '',
  login_bg_url text DEFAULT '',
  platform_name text DEFAULT '',
  login_title text DEFAULT '',
  login_subtitle text DEFAULT '',
  theme_colors jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

ALTER TABLE public.company_branding ENABLE ROW LEVEL SECURITY;

-- Superadmins can do everything
CREATE POLICY "Superadmins manage all company_branding"
ON public.company_branding FOR ALL
TO authenticated
USING (get_user_role(auth.uid()) = 'superadmin')
WITH CHECK (get_user_role(auth.uid()) = 'superadmin');

-- Admins can manage their own company branding
CREATE POLICY "Admins manage own company branding"
ON public.company_branding FOR ALL
TO authenticated
USING (
  get_user_role(auth.uid()) = 'admin'
  AND company_id IN (SELECT p.company_id FROM profiles p WHERE p.user_id = auth.uid())
)
WITH CHECK (
  get_user_role(auth.uid()) = 'admin'
  AND company_id IN (SELECT p.company_id FROM profiles p WHERE p.user_id = auth.uid())
);

-- Users can view their own company branding
CREATE POLICY "Users view own company branding"
ON public.company_branding FOR SELECT
TO authenticated
USING (
  company_id IN (SELECT p.company_id FROM profiles p WHERE p.user_id = auth.uid())
);
