
-- Tabela de logs de auditoria
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Tabela para controle de tentativas de login
CREATE TABLE public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  success boolean NOT NULL DEFAULT false,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index para consultas rápidas
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_login_attempts_email ON public.login_attempts(email);
CREATE INDEX idx_login_attempts_created_at ON public.login_attempts(created_at DESC);

-- RLS para audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can view all audit logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (get_user_role(auth.uid()) = 'superadmin');

CREATE POLICY "Admins can view own company audit logs"
ON public.audit_logs FOR SELECT
TO authenticated
USING (
  get_user_role(auth.uid()) = 'admin'
  AND user_id IN (
    SELECT p2.user_id FROM profiles p2
    WHERE p2.company_id IN (
      SELECT p.company_id FROM profiles p WHERE p.user_id = auth.uid()
    )
  )
);

CREATE POLICY "System can insert audit logs"
ON public.audit_logs FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Anon can insert audit logs"
ON public.audit_logs FOR INSERT
TO anon
WITH CHECK (true);

-- RLS para login_attempts
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmins can view login attempts"
ON public.login_attempts FOR SELECT
TO authenticated
USING (get_user_role(auth.uid()) = 'superadmin');

CREATE POLICY "System can insert login attempts"
ON public.login_attempts FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Auth can insert login attempts"
ON public.login_attempts FOR INSERT
TO authenticated
WITH CHECK (true);
