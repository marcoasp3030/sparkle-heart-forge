-- Add lock_id column to locker_doors for smart lock integration
ALTER TABLE public.locker_doors ADD COLUMN IF NOT EXISTS lock_id INTEGER DEFAULT NULL;

-- Index for quick lookup by lock_id
CREATE INDEX IF NOT EXISTS idx_locker_doors_lock_id ON public.locker_doors (lock_id) WHERE lock_id IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN public.locker_doors.lock_id IS 'ID da fechadura física vinculada a esta porta. Corresponde ao lock_id usado na tabela comandos_fechadura.';