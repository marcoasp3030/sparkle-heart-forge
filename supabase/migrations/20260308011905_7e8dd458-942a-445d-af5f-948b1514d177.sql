
-- Add person linking and usage type columns to locker_doors
ALTER TABLE public.locker_doors 
  ADD COLUMN IF NOT EXISTS occupied_by_person uuid REFERENCES public.funcionarios_clientes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS usage_type text NOT NULL DEFAULT 'temporary',
  ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone;
