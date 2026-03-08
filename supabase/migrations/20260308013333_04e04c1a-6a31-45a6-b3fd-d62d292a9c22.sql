
-- Reservations history + scheduled bookings table
CREATE TABLE public.locker_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  door_id uuid NOT NULL REFERENCES public.locker_doors(id) ON DELETE CASCADE,
  locker_id uuid NOT NULL REFERENCES public.lockers(id) ON DELETE CASCADE,
  person_id uuid REFERENCES public.funcionarios_clientes(id) ON DELETE SET NULL,
  reserved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  usage_type text NOT NULL DEFAULT 'temporary',
  status text NOT NULL DEFAULT 'active',
  starts_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone,
  released_at timestamp with time zone,
  renewed_count integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.locker_reservations ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage all reservations"
ON public.locker_reservations FOR ALL TO authenticated
USING (get_user_role(auth.uid()) IN ('admin', 'superadmin'))
WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'superadmin'));

CREATE POLICY "Users can view own reservations"
ON public.locker_reservations FOR SELECT TO authenticated
USING (reserved_by = auth.uid());

-- Add scheduled status to locker_doors
ALTER TABLE public.locker_doors ADD COLUMN IF NOT EXISTS scheduled_reservation_id uuid REFERENCES public.locker_reservations(id) ON DELETE SET NULL;

-- Add notification_sent flag to avoid duplicate alerts
ALTER TABLE public.locker_reservations ADD COLUMN IF NOT EXISTS expiry_notified boolean NOT NULL DEFAULT false;

-- Trigger for updated_at
CREATE TRIGGER update_locker_reservations_updated_at
  BEFORE UPDATE ON public.locker_reservations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
