
-- Drop restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Admins can manage doors" ON public.locker_doors;
DROP POLICY IF EXISTS "Admins can delete doors" ON public.locker_doors;
DROP POLICY IF EXISTS "Authenticated users can view doors" ON public.locker_doors;
DROP POLICY IF EXISTS "Users can reserve available doors" ON public.locker_doors;

-- Permissive policies (at least one must pass)
CREATE POLICY "Admins can manage doors"
  ON public.locker_doors FOR ALL
  TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'superadmin'))
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'superadmin'));

CREATE POLICY "Authenticated users can view doors"
  ON public.locker_doors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can reserve available doors"
  ON public.locker_doors FOR UPDATE
  TO authenticated
  USING (status = 'available' OR occupied_by = auth.uid())
  WITH CHECK (occupied_by = auth.uid() OR occupied_by IS NULL);
