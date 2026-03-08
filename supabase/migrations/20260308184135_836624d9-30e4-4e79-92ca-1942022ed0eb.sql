-- Add company_id and category to audit_logs for better filtering
ALTER TABLE public.audit_logs
ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'system';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_company_id ON public.audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON public.audit_logs(category);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON public.audit_logs(resource_type);

-- Trigger function: log locker_doors changes
CREATE OR REPLACE FUNCTION public.audit_locker_door_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_action text;
  v_details jsonb;
  v_user_id uuid;
BEGIN
  -- Get company from locker
  SELECT company_id INTO v_company_id FROM lockers WHERE id = COALESCE(NEW.locker_id, OLD.locker_id);
  v_user_id := auth.uid();

  IF TG_OP = 'UPDATE' THEN
    -- Status change
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      v_action := 'door_status_changed';
      v_details := jsonb_build_object(
        'door_number', NEW.door_number,
        'label', COALESCE(NEW.label, 'Porta ' || NEW.door_number),
        'old_status', OLD.status,
        'new_status', NEW.status,
        'occupied_by_person', NEW.occupied_by_person
      );
      INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, company_id, category)
      VALUES (v_user_id, v_action, 'locker_door', NEW.id::text, v_details, v_company_id, 'armarios');
    END IF;

    -- Occupant change
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
      INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, company_id, category)
      VALUES (v_user_id, v_action, 'locker_door', NEW.id::text, v_details, v_company_id, 'armarios');
    END IF;

    -- Expiration change
    IF OLD.expires_at IS DISTINCT FROM NEW.expires_at AND NEW.expires_at IS NOT NULL THEN
      v_details := jsonb_build_object(
        'door_number', NEW.door_number,
        'label', COALESCE(NEW.label, 'Porta ' || NEW.door_number),
        'old_expires', OLD.expires_at,
        'new_expires', NEW.expires_at
      );
      INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, company_id, category)
      VALUES (v_user_id, 'door_expiry_changed', 'locker_door', NEW.id::text, v_details, v_company_id, 'armarios');
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger function: log renewal_requests changes
CREATE OR REPLACE FUNCTION public.audit_renewal_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_details jsonb;
  v_action text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_details := jsonb_build_object(
      'person_id', NEW.person_id,
      'door_id', NEW.door_id,
      'requested_hours', NEW.requested_hours
    );
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, company_id, category)
    VALUES (auth.uid(), 'renewal_requested', 'renewal_request', NEW.id::text, v_details, NEW.company_id, 'renovacoes');
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    v_details := jsonb_build_object(
      'person_id', NEW.person_id,
      'door_id', NEW.door_id,
      'requested_hours', NEW.requested_hours,
      'old_status', OLD.status,
      'new_status', NEW.status,
      'admin_notes', NEW.admin_notes
    );
    v_action := CASE NEW.status
      WHEN 'approved' THEN 'renewal_approved'
      WHEN 'rejected' THEN 'renewal_rejected'
      ELSE 'renewal_status_changed'
    END;
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, company_id, category)
    VALUES (auth.uid(), v_action, 'renewal_request', NEW.id::text, v_details, NEW.company_id, 'renovacoes');
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger function: log funcionarios_clientes changes
CREATE OR REPLACE FUNCTION public.audit_person_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_details jsonb;
  v_action text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_details := jsonb_build_object('nome', NEW.nome, 'tipo', NEW.tipo, 'email', NEW.email);
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, company_id, category)
    VALUES (auth.uid(), 'person_created', 'person', NEW.id::text, v_details, NEW.company_id, 'pessoas');
  ELSIF TG_OP = 'UPDATE' THEN
    v_details := jsonb_build_object('nome', NEW.nome, 'changes', jsonb_build_object(
      'ativo', CASE WHEN OLD.ativo IS DISTINCT FROM NEW.ativo THEN jsonb_build_object('old', OLD.ativo, 'new', NEW.ativo) ELSE NULL END,
      'cargo', CASE WHEN OLD.cargo IS DISTINCT FROM NEW.cargo THEN jsonb_build_object('old', OLD.cargo, 'new', NEW.cargo) ELSE NULL END,
      'telefone', CASE WHEN OLD.telefone IS DISTINCT FROM NEW.telefone THEN jsonb_build_object('old', OLD.telefone, 'new', NEW.telefone) ELSE NULL END
    ));
    v_action := CASE
      WHEN OLD.ativo AND NOT NEW.ativo THEN 'person_deactivated'
      WHEN NOT OLD.ativo AND NEW.ativo THEN 'person_reactivated'
      ELSE 'person_updated'
    END;
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, company_id, category)
    VALUES (auth.uid(), v_action, 'person', NEW.id::text, v_details, NEW.company_id, 'pessoas');
  ELSIF TG_OP = 'DELETE' THEN
    v_details := jsonb_build_object('nome', OLD.nome, 'tipo', OLD.tipo);
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, company_id, category)
    VALUES (auth.uid(), 'person_deleted', 'person', OLD.id::text, v_details, OLD.company_id, 'pessoas');
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger function: log locker_reservations changes
CREATE OR REPLACE FUNCTION public.audit_reservation_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_details jsonb;
  v_action text;
BEGIN
  SELECT company_id INTO v_company_id FROM lockers WHERE id = COALESCE(NEW.locker_id, OLD.locker_id);

  IF TG_OP = 'INSERT' THEN
    v_details := jsonb_build_object('door_id', NEW.door_id, 'person_id', NEW.person_id, 'usage_type', NEW.usage_type, 'expires_at', NEW.expires_at);
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, company_id, category)
    VALUES (auth.uid(), 'reservation_created', 'reservation', NEW.id::text, v_details, v_company_id, 'armarios');
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    v_action := CASE NEW.status
      WHEN 'released' THEN 'reservation_released'
      WHEN 'expired' THEN 'reservation_expired'
      WHEN 'cancelled' THEN 'reservation_cancelled'
      ELSE 'reservation_status_changed'
    END;
    v_details := jsonb_build_object('door_id', NEW.door_id, 'person_id', NEW.person_id, 'old_status', OLD.status, 'new_status', NEW.status);
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, company_id, category)
    VALUES (auth.uid(), v_action, 'reservation', NEW.id::text, v_details, v_company_id, 'armarios');
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create triggers
CREATE TRIGGER audit_locker_doors_trigger
  AFTER UPDATE ON public.locker_doors
  FOR EACH ROW EXECUTE FUNCTION public.audit_locker_door_changes();

CREATE TRIGGER audit_renewal_trigger
  AFTER INSERT OR UPDATE ON public.renewal_requests
  FOR EACH ROW EXECUTE FUNCTION public.audit_renewal_changes();

CREATE TRIGGER audit_person_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.funcionarios_clientes
  FOR EACH ROW EXECUTE FUNCTION public.audit_person_changes();

CREATE TRIGGER audit_reservation_trigger
  AFTER INSERT OR UPDATE ON public.locker_reservations
  FOR EACH ROW EXECUTE FUNCTION public.audit_reservation_changes();

-- Update RLS: admins see audit logs of their company
DROP POLICY IF EXISTS "Admins can view own company audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view own company audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (
  get_user_role(auth.uid()) = 'admin'
  AND company_id IN (SELECT p.company_id FROM profiles p WHERE p.user_id = auth.uid())
);