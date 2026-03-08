-- Table for renewal requests from portal users
CREATE TABLE public.renewal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  door_id uuid NOT NULL REFERENCES public.locker_doors(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.funcionarios_clientes(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  requested_hours integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.renewal_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view own renewal requests"
ON public.renewal_requests FOR SELECT TO authenticated
USING (person_id IN (SELECT id FROM funcionarios_clientes WHERE user_id = auth.uid()));

-- Users can insert their own requests
CREATE POLICY "Users can create renewal requests"
ON public.renewal_requests FOR INSERT TO authenticated
WITH CHECK (person_id IN (SELECT id FROM funcionarios_clientes WHERE user_id = auth.uid()));

-- Admins can manage all requests for their company
CREATE POLICY "Admins manage renewal requests"
ON public.renewal_requests FOR ALL TO authenticated
USING (get_user_role(auth.uid()) IN ('admin', 'superadmin'))
WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'superadmin'));

-- Trigger for updated_at
CREATE TRIGGER update_renewal_requests_updated_at
  BEFORE UPDATE ON public.renewal_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();