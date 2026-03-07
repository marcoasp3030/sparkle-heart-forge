
CREATE TABLE public.platform_settings_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can manage settings history"
  ON public.platform_settings_history
  FOR ALL
  TO authenticated
  USING (get_user_role(auth.uid()) = 'superadmin')
  WITH CHECK (get_user_role(auth.uid()) = 'superadmin');

CREATE POLICY "Anyone can view settings history"
  ON public.platform_settings_history
  FOR SELECT
  TO authenticated
  USING (true);
