
-- Platform settings table for global theme customization
CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings (needed to apply theme)
CREATE POLICY "Anyone can view platform settings"
  ON public.platform_settings FOR SELECT
  TO authenticated
  USING (true);

-- Only superadmins can modify
CREATE POLICY "Superadmins can manage platform settings"
  ON public.platform_settings FOR ALL
  TO authenticated
  USING (get_user_role(auth.uid()) = 'superadmin')
  WITH CHECK (get_user_role(auth.uid()) = 'superadmin');

-- Trigger for updated_at
CREATE TRIGGER update_platform_settings_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Storage bucket for platform assets
INSERT INTO storage.buckets (id, name, public) VALUES ('platform-assets', 'platform-assets', true);

-- Storage policies
CREATE POLICY "Anyone can view platform assets"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'platform-assets');

CREATE POLICY "Superadmins can upload platform assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'platform-assets' AND get_user_role(auth.uid()) = 'superadmin');

CREATE POLICY "Superadmins can update platform assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'platform-assets' AND get_user_role(auth.uid()) = 'superadmin');

CREATE POLICY "Superadmins can delete platform assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'platform-assets' AND get_user_role(auth.uid()) = 'superadmin');

-- Seed default settings
INSERT INTO public.platform_settings (key, value) VALUES
  ('theme_colors', '{"primary": "330 81% 46%", "primary_glow": "330 90% 60%", "secondary": "224 60% 48%", "accent": "25 95% 53%", "success": "152 60% 42%", "destructive": "0 72% 51%", "sidebar_bg": "222 47% 11%", "preset": "default"}'::jsonb),
  ('branding', '{"platform_name": "Locker System", "login_title": "Bem-vindo", "login_subtitle": "Faça login para acessar o sistema", "sidebar_description": ""}'::jsonb),
  ('images', '{"logo_url": "", "favicon_url": "", "login_bg_url": "", "sidebar_logo_url": ""}'::jsonb);
