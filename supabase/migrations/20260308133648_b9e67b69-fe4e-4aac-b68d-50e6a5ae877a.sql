
-- Waitlist table for smart queue system
CREATE TABLE public.locker_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  locker_id uuid NOT NULL REFERENCES public.lockers(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.funcionarios_clientes(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  preferred_size text DEFAULT 'any',
  status text NOT NULL DEFAULT 'waiting',
  notified_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.locker_waitlist ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins manage waitlist" ON public.locker_waitlist
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'superadmin'))
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'superadmin'));

CREATE POLICY "Users view own waitlist entries" ON public.locker_waitlist
  FOR SELECT TO authenticated
  USING (requested_by = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.locker_waitlist;
