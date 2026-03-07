
CREATE POLICY "Public can check company permissions"
ON public.company_permissions FOR SELECT
TO anon
USING (true);
