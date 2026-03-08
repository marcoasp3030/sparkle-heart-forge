-- Function to notify admins when a renewal request is created
CREATE OR REPLACE FUNCTION public.notify_admin_renewal_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_person_name text;
  v_door_label text;
  v_admin_user_id uuid;
BEGIN
  -- Get person name
  SELECT nome INTO v_person_name FROM funcionarios_clientes WHERE id = NEW.person_id;
  
  -- Get door label
  SELECT COALESCE(label, 'Porta #' || door_number::text) INTO v_door_label FROM locker_doors WHERE id = NEW.door_id;
  
  -- Notify all admins of the company
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

CREATE TRIGGER on_renewal_request_created
  AFTER INSERT ON public.renewal_requests
  FOR EACH ROW EXECUTE FUNCTION notify_admin_renewal_request();