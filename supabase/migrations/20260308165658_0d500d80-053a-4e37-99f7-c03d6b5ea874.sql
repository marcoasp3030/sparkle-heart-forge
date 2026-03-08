
-- Add user_id column to funcionarios_clientes to link person to auth user
ALTER TABLE public.funcionarios_clientes 
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create unique index so one auth user maps to one person record
CREATE UNIQUE INDEX IF NOT EXISTS idx_funcionarios_clientes_user_id 
  ON public.funcionarios_clientes(user_id) WHERE user_id IS NOT NULL;

-- RLS policy: users with role 'user' can view their own person record
CREATE POLICY "Users can view own person record"
  ON public.funcionarios_clientes
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- RLS: users can view locker_doors assigned to them via person
CREATE POLICY "Users can view doors assigned to their person"
  ON public.locker_doors
  FOR SELECT
  TO authenticated
  USING (
    occupied_by_person IN (
      SELECT id FROM public.funcionarios_clientes WHERE user_id = auth.uid()
    )
  );

-- RLS: users can view reservations for their person
CREATE POLICY "Users can view reservations for their person"
  ON public.locker_reservations
  FOR SELECT
  TO authenticated
  USING (
    person_id IN (
      SELECT id FROM public.funcionarios_clientes WHERE user_id = auth.uid()
    )
  );

-- RLS: users can view lockers that have doors assigned to them
CREATE POLICY "Users can view their lockers"
  ON public.lockers
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT ld.locker_id FROM public.locker_doors ld
      JOIN public.funcionarios_clientes fc ON fc.id = ld.occupied_by_person
      WHERE fc.user_id = auth.uid()
    )
  );
