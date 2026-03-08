ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_changed boolean NOT NULL DEFAULT true;

-- Set password_changed = false for all users with role 'user' (portal users created by admin)
UPDATE public.profiles SET password_changed = false WHERE role = 'user';