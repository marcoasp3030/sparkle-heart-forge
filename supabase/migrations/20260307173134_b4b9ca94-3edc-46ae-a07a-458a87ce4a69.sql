
CREATE TABLE public.company_whatsapp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  instance_name text NOT NULL DEFAULT '',
  instance_token text DEFAULT '',
  status text NOT NULL DEFAULT 'disconnected',
  phone_number text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

ALTER TABLE public.company_whatsapp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins manage all company_whatsapp"
  ON public.company_whatsapp FOR ALL
  USING (get_user_role(auth.uid()) = 'superadmin')
  WITH CHECK (get_user_role(auth.uid()) = 'superadmin');

CREATE POLICY "Admins manage own company whatsapp"
  ON public.company_whatsapp FOR ALL
  USING (
    get_user_role(auth.uid()) = 'admin'
    AND company_id IN (SELECT p.company_id FROM profiles p WHERE p.user_id = auth.uid())
  )
  WITH CHECK (
    get_user_role(auth.uid()) = 'admin'
    AND company_id IN (SELECT p.company_id FROM profiles p WHERE p.user_id = auth.uid())
  );

CREATE POLICY "Users view own company whatsapp"
  ON public.company_whatsapp FOR SELECT
  USING (company_id IN (SELECT p.company_id FROM profiles p WHERE p.user_id = auth.uid()));
