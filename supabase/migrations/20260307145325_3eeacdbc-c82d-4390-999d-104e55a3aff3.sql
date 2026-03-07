
CREATE POLICY "Public can view company branding"
ON public.company_branding FOR SELECT
TO anon
USING (true);
