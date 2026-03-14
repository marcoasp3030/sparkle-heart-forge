CREATE TABLE IF NOT EXISTS public.permission_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  permissions JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.permission_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins manage permission_groups" ON public.permission_groups
FOR ALL TO authenticated
USING (get_user_role(auth.uid()) = 'superadmin')
WITH CHECK (get_user_role(auth.uid()) = 'superadmin');

CREATE POLICY "Admins can view permission_groups" ON public.permission_groups
FOR SELECT TO authenticated
USING (true);