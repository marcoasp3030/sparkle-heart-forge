-- ============================================================
-- SCRIPT COMPLETO: Schema do PBLocker para PostgreSQL
-- Banco: pblocker
-- Gerado em: 2026-03-13
-- 
-- INSTRUÇÕES:
--   psql -U admin -d pblocker -h localhost -f schema-completo-pblocker.sql
-- ============================================================

-- ============================================
-- EXTENSÕES
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. TABELA: users (substitui auth.users do Supabase)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email_confirmed BOOLEAN DEFAULT FALSE,
  raw_user_meta_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. TABELA: companies
-- ============================================
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT DEFAULT 'employee',
  description TEXT DEFAULT '',
  active BOOLEAN DEFAULT TRUE,
  cnpj TEXT DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  contact_name TEXT DEFAULT '',
  address TEXT DEFAULT '',
  city TEXT DEFAULT '',
  state TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. TABELA: profiles
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  full_name TEXT,
  role TEXT DEFAULT 'user',
  company_id UUID REFERENCES companies(id),
  avatar_url TEXT,
  password_changed BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. TABELA: company_branding
-- ============================================
CREATE TABLE IF NOT EXISTS company_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) UNIQUE,
  logo_url TEXT DEFAULT '',
  sidebar_logo_url TEXT DEFAULT '',
  favicon_url TEXT DEFAULT '',
  login_bg_url TEXT DEFAULT '',
  platform_name TEXT DEFAULT '',
  login_title TEXT DEFAULT '',
  login_subtitle TEXT DEFAULT '',
  theme_colors JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. TABELA: company_permissions
-- ============================================
CREATE TABLE IF NOT EXISTS company_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  permission TEXT NOT NULL,
  enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. TABELA: company_whatsapp
-- ============================================
CREATE TABLE IF NOT EXISTS company_whatsapp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) UNIQUE,
  instance_name TEXT DEFAULT '',
  instance_token TEXT DEFAULT '',
  phone_number TEXT DEFAULT '',
  status TEXT DEFAULT 'disconnected',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. TABELA: company_notification_templates
-- ============================================
CREATE TABLE IF NOT EXISTS company_notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  type TEXT NOT NULL,
  channel TEXT DEFAULT 'whatsapp',
  template_text TEXT DEFAULT '',
  footer TEXT DEFAULT '',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. TABELA: departamentos
-- ============================================
CREATE TABLE IF NOT EXISTS departamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  nome TEXT NOT NULL,
  descricao TEXT DEFAULT '',
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 9. TABELA: setores
-- ============================================
CREATE TABLE IF NOT EXISTS setores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  departamento_id UUID REFERENCES departamentos(id),
  nome TEXT NOT NULL,
  descricao TEXT DEFAULT '',
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 10. TABELA: funcionarios_clientes
-- ============================================
CREATE TABLE IF NOT EXISTS funcionarios_clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  user_id UUID REFERENCES users(id),
  departamento_id UUID REFERENCES departamentos(id),
  setor_id UUID REFERENCES setores(id),
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  cargo TEXT DEFAULT '',
  tipo TEXT DEFAULT 'funcionario',
  matricula TEXT,
  avatar_url TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  notification_whatsapp BOOLEAN DEFAULT TRUE,
  notification_email BOOLEAN DEFAULT TRUE,
  notification_renewal BOOLEAN DEFAULT TRUE,
  notification_expiry BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 11. TABELA: lockers
-- ============================================
CREATE TABLE IF NOT EXISTS lockers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  name TEXT NOT NULL,
  location TEXT DEFAULT '',
  rows INTEGER DEFAULT 4,
  columns INTEGER DEFAULT 1,
  orientation TEXT DEFAULT 'vertical',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 12. TABELA: locker_doors
-- ============================================
CREATE TABLE IF NOT EXISTS locker_doors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  locker_id UUID NOT NULL REFERENCES lockers(id) ON DELETE CASCADE,
  door_number INTEGER NOT NULL,
  label TEXT,
  size TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'available',
  usage_type TEXT DEFAULT 'temporary',
  occupied_by UUID REFERENCES users(id),
  occupied_by_person UUID REFERENCES funcionarios_clientes(id),
  occupied_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  scheduled_reservation_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 13. TABELA: locker_reservations
-- ============================================
CREATE TABLE IF NOT EXISTS locker_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  locker_id UUID NOT NULL REFERENCES lockers(id),
  door_id UUID NOT NULL REFERENCES locker_doors(id),
  reserved_by UUID REFERENCES users(id),
  person_id UUID REFERENCES funcionarios_clientes(id),
  status TEXT DEFAULT 'active',
  usage_type TEXT DEFAULT 'temporary',
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  renewed_count INTEGER DEFAULT 0,
  expiry_notified BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FK circular: locker_doors → locker_reservations
ALTER TABLE locker_doors
  ADD CONSTRAINT locker_doors_scheduled_reservation_id_fkey
  FOREIGN KEY (scheduled_reservation_id) REFERENCES locker_reservations(id);

-- ============================================
-- 14. TABELA: locker_waitlist
-- ============================================
CREATE TABLE IF NOT EXISTS locker_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  locker_id UUID NOT NULL REFERENCES lockers(id),
  person_id UUID NOT NULL REFERENCES funcionarios_clientes(id),
  requested_by UUID REFERENCES users(id),
  preferred_size TEXT DEFAULT 'any',
  status TEXT DEFAULT 'waiting',
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 15. TABELA: renewal_requests
-- ============================================
CREATE TABLE IF NOT EXISTS renewal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  door_id UUID NOT NULL REFERENCES locker_doors(id),
  person_id UUID NOT NULL REFERENCES funcionarios_clientes(id),
  requested_hours INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending',
  admin_notes TEXT,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 16. TABELA: notifications
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  message TEXT DEFAULT '',
  type TEXT DEFAULT 'info',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 17. TABELA: audit_logs
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  company_id UUID REFERENCES companies(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  category TEXT DEFAULT 'system',
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 18. TABELA: login_attempts
-- ============================================
CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  success BOOLEAN DEFAULT FALSE,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 19. TABELA: platform_settings
-- ============================================
CREATE TABLE IF NOT EXISTS platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 20. TABELA: platform_settings_history
-- ============================================
CREATE TABLE IF NOT EXISTS platform_settings_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL,
  value JSONB DEFAULT '{}',
  changed_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 21. TABELA: password_reset_tokens
-- ============================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 22. TABELA: permission_groups
-- ============================================
CREATE TABLE IF NOT EXISTS permission_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  permissions JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

CREATE INDEX IF NOT EXISTS idx_funcionarios_company_id ON funcionarios_clientes(company_id);
CREATE INDEX IF NOT EXISTS idx_funcionarios_user_id ON funcionarios_clientes(user_id);
CREATE INDEX IF NOT EXISTS idx_funcionarios_departamento_id ON funcionarios_clientes(departamento_id);
CREATE INDEX IF NOT EXISTS idx_funcionarios_setor_id ON funcionarios_clientes(setor_id);

CREATE INDEX IF NOT EXISTS idx_lockers_company_id ON lockers(company_id);

CREATE INDEX IF NOT EXISTS idx_locker_doors_locker_id ON locker_doors(locker_id);
CREATE INDEX IF NOT EXISTS idx_locker_doors_status ON locker_doors(status);
CREATE INDEX IF NOT EXISTS idx_locker_doors_occupied_by_person ON locker_doors(occupied_by_person);
CREATE INDEX IF NOT EXISTS idx_locker_doors_expires_at ON locker_doors(expires_at);

CREATE INDEX IF NOT EXISTS idx_locker_reservations_door_id ON locker_reservations(door_id);
CREATE INDEX IF NOT EXISTS idx_locker_reservations_person_id ON locker_reservations(person_id);
CREATE INDEX IF NOT EXISTS idx_locker_reservations_status ON locker_reservations(status);

CREATE INDEX IF NOT EXISTS idx_renewal_requests_company_id ON renewal_requests(company_id);
CREATE INDEX IF NOT EXISTS idx_renewal_requests_status ON renewal_requests(status);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);

CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON audit_logs(category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON login_attempts(created_at);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_locker_waitlist_company_id ON locker_waitlist(company_id);
CREATE INDEX IF NOT EXISTS idx_locker_waitlist_person_id ON locker_waitlist(person_id);

CREATE INDEX IF NOT EXISTS idx_company_permissions_company_id ON company_permissions(company_id);
CREATE INDEX IF NOT EXISTS idx_departamentos_company_id ON departamentos(company_id);
CREATE INDEX IF NOT EXISTS idx_setores_company_id ON setores(company_id);


-- ============================================================
-- FUNÇÕES DO BANCO
-- ============================================================

-- Função: get_user_role
CREATE OR REPLACE FUNCTION get_user_role(_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT role FROM profiles WHERE user_id = _user_id LIMIT 1;
$$;

-- Função: get_login_lockout_status
CREATE OR REPLACE FUNCTION get_login_lockout_status(_email TEXT)
RETURNS TABLE(
  bloqueado BOOLEAN,
  mensagem TEXT,
  minutos_restantes INTEGER,
  nivel TEXT,
  segundos_restantes INTEGER,
  tentativas_restantes INTEGER,
  total_falhas BIGINT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_email TEXT := lower(trim(_email));
  v_max_attempts INTEGER := 5;
  v_lockout_seconds INTEGER := 60;
  v_window INTERVAL := INTERVAL '30 minutes';
  v_falhas BIGINT := 0;
  v_restantes INTEGER := 0;
  v_last_attempt TIMESTAMPTZ;
  v_unlock_at TIMESTAMPTZ;
  v_segundos INTEGER := 0;
BEGIN
  IF v_email IS NULL OR v_email = '' THEN
    RETURN QUERY SELECT FALSE, ''::TEXT, 0, 'info'::TEXT, 0, v_max_attempts, 0::BIGINT;
    RETURN;
  END IF;

  SELECT COUNT(*), MAX(created_at)
    INTO v_falhas, v_last_attempt
  FROM login_attempts
  WHERE email = v_email
    AND success = FALSE
    AND created_at >= NOW() - v_window;

  IF v_falhas >= v_max_attempts AND v_last_attempt IS NOT NULL THEN
    v_unlock_at := v_last_attempt + make_interval(secs => v_lockout_seconds);

    IF NOW() < v_unlock_at THEN
      v_segundos := CEIL(EXTRACT(EPOCH FROM (v_unlock_at - NOW())))::INTEGER;
      RETURN QUERY
      SELECT
        TRUE,
        format('Sua conta foi temporariamente bloqueada por segurança. Aguarde %s segundo(s).', v_segundos),
        GREATEST(1, CEIL(v_segundos::NUMERIC / 60.0)::INTEGER),
        'bloqueado'::TEXT,
        v_segundos,
        0,
        v_falhas;
      RETURN;
    END IF;
  END IF;

  v_restantes := GREATEST(0, v_max_attempts - v_falhas::INTEGER);

  RETURN QUERY
  SELECT
    FALSE,
    CASE
      WHEN v_falhas = 0 THEN ''
      WHEN v_restantes <= 1 THEN '⚠️ Última tentativa! Após esta, sua conta será bloqueada temporariamente.'
      WHEN v_restantes <= 2 THEN format('Atenção: restam apenas %s tentativas.', v_restantes)
      ELSE format('E-mail ou senha incorretos. Restam %s tentativa(s).', v_restantes)
    END,
    0,
    CASE
      WHEN v_falhas <= 2 THEN 'info'
      WHEN v_falhas <= 3 THEN 'aviso'
      WHEN v_falhas <= 4 THEN 'perigo'
      ELSE 'bloqueado'
    END,
    0,
    v_restantes,
    v_falhas;
END;
$$;

-- Função: register_login_attempt
CREATE OR REPLACE FUNCTION register_login_attempt(_email TEXT, _success BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO login_attempts (email, success) VALUES (lower(trim(_email)), _success);
  -- Limpa tentativas anteriores após login bem-sucedido
  IF _success THEN
    DELETE FROM login_attempts WHERE email = lower(trim(_email)) AND success = FALSE;
  END IF;
END;
$$;


-- ============================================================
-- TRIGGERS: updated_at AUTOMÁTICO
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Aplica trigger de updated_at em todas as tabelas relevantes
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'users','profiles','companies','company_branding','company_permissions',
    'company_whatsapp','company_notification_templates','departamentos','setores',
    'funcionarios_clientes','lockers','locker_doors','locker_reservations',
    'locker_waitlist','renewal_requests','platform_settings'
  ]) LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS update_%s_updated_at ON %I', t, t
    );
    EXECUTE format(
      'CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
      t, t
    );
  END LOOP;
END $$;


-- ============================================================
-- TRIGGERS: AUDITORIA AUTOMÁTICA
-- ============================================================

-- Trigger: Auditoria de alterações em locker_doors
CREATE OR REPLACE FUNCTION audit_locker_door_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_company_id UUID;
  v_action TEXT;
  v_details JSONB;
BEGIN
  SELECT company_id INTO v_company_id FROM lockers WHERE id = COALESCE(NEW.locker_id, OLD.locker_id);

  IF TG_OP = 'UPDATE' THEN
    -- Mudança de status
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_details := jsonb_build_object(
        'door_number', NEW.door_number,
        'label', COALESCE(NEW.label, 'Porta ' || NEW.door_number),
        'old_status', OLD.status,
        'new_status', NEW.status,
        'occupied_by_person', NEW.occupied_by_person
      );
      INSERT INTO audit_logs (action, resource_type, resource_id, details, company_id, category)
      VALUES ('door_status_changed', 'locker_door', NEW.id::TEXT, v_details, v_company_id, 'armarios');
    END IF;

    -- Mudança de ocupante
    IF OLD.occupied_by_person IS DISTINCT FROM NEW.occupied_by_person THEN
      v_action := CASE
        WHEN NEW.occupied_by_person IS NOT NULL AND OLD.occupied_by_person IS NULL THEN 'door_assigned'
        WHEN NEW.occupied_by_person IS NULL AND OLD.occupied_by_person IS NOT NULL THEN 'door_released'
        ELSE 'door_reassigned'
      END;
      v_details := jsonb_build_object(
        'door_number', NEW.door_number,
        'label', COALESCE(NEW.label, 'Porta ' || NEW.door_number),
        'old_person', OLD.occupied_by_person,
        'new_person', NEW.occupied_by_person
      );
      INSERT INTO audit_logs (action, resource_type, resource_id, details, company_id, category)
      VALUES (v_action, 'locker_door', NEW.id::TEXT, v_details, v_company_id, 'armarios');
    END IF;

    -- Mudança de expiração
    IF OLD.expires_at IS DISTINCT FROM NEW.expires_at AND NEW.expires_at IS NOT NULL THEN
      v_details := jsonb_build_object(
        'door_number', NEW.door_number,
        'label', COALESCE(NEW.label, 'Porta ' || NEW.door_number),
        'old_expires', OLD.expires_at,
        'new_expires', NEW.expires_at
      );
      INSERT INTO audit_logs (action, resource_type, resource_id, details, company_id, category)
      VALUES ('door_expiry_changed', 'locker_door', NEW.id::TEXT, v_details, v_company_id, 'armarios');
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS audit_locker_door_changes_trigger ON locker_doors;
CREATE TRIGGER audit_locker_door_changes_trigger
  AFTER UPDATE ON locker_doors
  FOR EACH ROW EXECUTE FUNCTION audit_locker_door_changes();

-- Trigger: Auditoria de reservas
CREATE OR REPLACE FUNCTION audit_reservation_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_company_id UUID;
  v_details JSONB;
  v_action TEXT;
BEGIN
  SELECT company_id INTO v_company_id FROM lockers WHERE id = COALESCE(NEW.locker_id, OLD.locker_id);

  IF TG_OP = 'INSERT' THEN
    v_details := jsonb_build_object(
      'door_id', NEW.door_id, 'person_id', NEW.person_id,
      'usage_type', NEW.usage_type, 'expires_at', NEW.expires_at
    );
    INSERT INTO audit_logs (action, resource_type, resource_id, details, company_id, category)
    VALUES ('reservation_created', 'reservation', NEW.id::TEXT, v_details, v_company_id, 'armarios');
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    v_action := CASE NEW.status
      WHEN 'released' THEN 'reservation_released'
      WHEN 'expired' THEN 'reservation_expired'
      WHEN 'cancelled' THEN 'reservation_cancelled'
      ELSE 'reservation_status_changed'
    END;
    v_details := jsonb_build_object(
      'door_id', NEW.door_id, 'person_id', NEW.person_id,
      'old_status', OLD.status, 'new_status', NEW.status
    );
    INSERT INTO audit_logs (action, resource_type, resource_id, details, company_id, category)
    VALUES (v_action, 'reservation', NEW.id::TEXT, v_details, v_company_id, 'armarios');
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS audit_reservation_changes_trigger ON locker_reservations;
CREATE TRIGGER audit_reservation_changes_trigger
  AFTER INSERT OR UPDATE ON locker_reservations
  FOR EACH ROW EXECUTE FUNCTION audit_reservation_changes();

-- Trigger: Auditoria de pessoas (funcionários/clientes)
CREATE OR REPLACE FUNCTION audit_person_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_details JSONB;
  v_action TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_details := jsonb_build_object('nome', NEW.nome, 'tipo', NEW.tipo, 'email', NEW.email);
    INSERT INTO audit_logs (action, resource_type, resource_id, details, company_id, category)
    VALUES ('person_created', 'person', NEW.id::TEXT, v_details, NEW.company_id, 'pessoas');
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := CASE
      WHEN OLD.ativo AND NOT NEW.ativo THEN 'person_deactivated'
      WHEN NOT OLD.ativo AND NEW.ativo THEN 'person_reactivated'
      ELSE 'person_updated'
    END;
    v_details := jsonb_build_object('nome', NEW.nome, 'changes', jsonb_build_object(
      'ativo', CASE WHEN OLD.ativo IS DISTINCT FROM NEW.ativo THEN jsonb_build_object('old', OLD.ativo, 'new', NEW.ativo) ELSE NULL END,
      'cargo', CASE WHEN OLD.cargo IS DISTINCT FROM NEW.cargo THEN jsonb_build_object('old', OLD.cargo, 'new', NEW.cargo) ELSE NULL END,
      'telefone', CASE WHEN OLD.telefone IS DISTINCT FROM NEW.telefone THEN jsonb_build_object('old', OLD.telefone, 'new', NEW.telefone) ELSE NULL END
    ));
    INSERT INTO audit_logs (action, resource_type, resource_id, details, company_id, category)
    VALUES (v_action, 'person', NEW.id::TEXT, v_details, NEW.company_id, 'pessoas');
  ELSIF TG_OP = 'DELETE' THEN
    v_details := jsonb_build_object('nome', OLD.nome, 'tipo', OLD.tipo);
    INSERT INTO audit_logs (action, resource_type, resource_id, details, company_id, category)
    VALUES ('person_deleted', 'person', OLD.id::TEXT, v_details, OLD.company_id, 'pessoas');
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS audit_person_changes_trigger ON funcionarios_clientes;
CREATE TRIGGER audit_person_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON funcionarios_clientes
  FOR EACH ROW EXECUTE FUNCTION audit_person_changes();

-- Trigger: Auditoria de renovações
CREATE OR REPLACE FUNCTION audit_renewal_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_details JSONB;
  v_action TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_details := jsonb_build_object(
      'person_id', NEW.person_id, 'door_id', NEW.door_id,
      'requested_hours', NEW.requested_hours
    );
    INSERT INTO audit_logs (action, resource_type, resource_id, details, company_id, category)
    VALUES ('renewal_requested', 'renewal_request', NEW.id::TEXT, v_details, NEW.company_id, 'renovacoes');
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    v_details := jsonb_build_object(
      'person_id', NEW.person_id, 'door_id', NEW.door_id,
      'requested_hours', NEW.requested_hours,
      'old_status', OLD.status, 'new_status', NEW.status,
      'admin_notes', NEW.admin_notes
    );
    v_action := CASE NEW.status
      WHEN 'approved' THEN 'renewal_approved'
      WHEN 'rejected' THEN 'renewal_rejected'
      ELSE 'renewal_status_changed'
    END;
    INSERT INTO audit_logs (action, resource_type, resource_id, details, company_id, category)
    VALUES (v_action, 'renewal_request', NEW.id::TEXT, v_details, NEW.company_id, 'renovacoes');
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS audit_renewal_changes_trigger ON renewal_requests;
CREATE TRIGGER audit_renewal_changes_trigger
  AFTER INSERT OR UPDATE ON renewal_requests
  FOR EACH ROW EXECUTE FUNCTION audit_renewal_changes();

-- Trigger: Notificar admins sobre solicitações de renovação
CREATE OR REPLACE FUNCTION notify_admin_renewal_request()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_person_name TEXT;
  v_door_label TEXT;
  v_admin_user_id UUID;
BEGIN
  SELECT nome INTO v_person_name FROM funcionarios_clientes WHERE id = NEW.person_id;
  SELECT COALESCE(label, 'Porta #' || door_number::TEXT) INTO v_door_label FROM locker_doors WHERE id = NEW.door_id;

  FOR v_admin_user_id IN
    SELECT user_id FROM profiles
    WHERE company_id = NEW.company_id
    AND role IN ('admin', 'superadmin')
  LOOP
    INSERT INTO notifications (user_id, title, message, type)
    VALUES (
      v_admin_user_id,
      '🔄 Solicitação de Renovação',
      v_person_name || ' solicitou renovação de +' || NEW.requested_hours || 'h para ' || v_door_label,
      'renewal_request'
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_admin_renewal_trigger ON renewal_requests;
CREATE TRIGGER notify_admin_renewal_trigger
  AFTER INSERT ON renewal_requests
  FOR EACH ROW EXECUTE FUNCTION notify_admin_renewal_request();


-- ============================================================
-- DADOS INICIAIS (configurações padrão)
-- ============================================================

INSERT INTO platform_settings (key, value) VALUES
  ('system_name', '"PBLocker"'),
  ('default_expiry_hours', '4'),
  ('max_renewal_hours', '12'),
  ('enable_waitlist', 'true'),
  ('enable_renewal_requests', 'true')
ON CONFLICT (key) DO NOTHING;


-- ============================================================
-- CRIAR SUPERADMIN INICIAL
-- ============================================================
-- 
-- IMPORTANTE: Execute estes comandos SEPARADAMENTE após criar o schema.
-- Primeiro gere o hash da senha:
--
--   node -e "require('bcryptjs').hash('SuaSenhaForte123', 12).then(h => console.log(h))"
--
-- Depois execute:
--
-- INSERT INTO users (email, password_hash, email_confirmed)
-- VALUES ('admin@pblocker.sistembr.com.br', '$2a$12$HASH_GERADO', TRUE);
--
-- INSERT INTO companies (name, type) VALUES ('Minha Empresa', 'employee');
--
-- INSERT INTO profiles (user_id, full_name, role, company_id, password_changed)
-- VALUES (
--   (SELECT id FROM users WHERE email = 'admin@pblocker.sistembr.com.br'),
--   'Administrador',
--   'superadmin',
--   (SELECT id FROM companies LIMIT 1),
--   TRUE
-- );
--
-- ============================================================

-- FIM DO SCRIPT
SELECT 'Schema PBLocker criado com sucesso! 🎉' AS resultado;
