
CREATE TABLE public.company_notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type text NOT NULL,
  template_text text NOT NULL DEFAULT '',
  footer text DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (company_id, type)
);

ALTER TABLE public.company_notification_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage own company templates"
ON public.company_notification_templates
FOR ALL
TO authenticated
USING (
  (get_user_role(auth.uid()) = 'admin' AND company_id IN (SELECT p.company_id FROM profiles p WHERE p.user_id = auth.uid()))
)
WITH CHECK (
  (get_user_role(auth.uid()) = 'admin' AND company_id IN (SELECT p.company_id FROM profiles p WHERE p.user_id = auth.uid()))
);

CREATE POLICY "Superadmins manage all templates"
ON public.company_notification_templates
FOR ALL
TO authenticated
USING (get_user_role(auth.uid()) = 'superadmin')
WITH CHECK (get_user_role(auth.uid()) = 'superadmin');

CREATE POLICY "Users view own company templates"
ON public.company_notification_templates
FOR SELECT
TO authenticated
USING (company_id IN (SELECT p.company_id FROM profiles p WHERE p.user_id = auth.uid()));
