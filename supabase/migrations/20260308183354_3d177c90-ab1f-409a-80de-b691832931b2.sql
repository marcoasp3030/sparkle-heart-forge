-- Create avatars storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: Users can upload their own avatar
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: Users can update their own avatar
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: Users can delete their own avatar
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: Anyone can view avatars (public bucket)
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Add notification preferences to funcionarios_clientes
ALTER TABLE public.funcionarios_clientes
ADD COLUMN IF NOT EXISTS notification_email BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_whatsapp BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_expiry BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_renewal BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL;

-- Allow users to update their own person record (phone, avatar, notifications)
CREATE POLICY "Users can update own person record"
ON public.funcionarios_clientes FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());