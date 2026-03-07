
-- Allow admins to delete lockers
CREATE POLICY "Admins can delete lockers"
  ON public.lockers FOR DELETE TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'superadmin'));

-- Allow admins to delete doors
CREATE POLICY "Admins can delete doors"
  ON public.locker_doors FOR DELETE TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'superadmin'));
