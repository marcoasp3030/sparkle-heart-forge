
ALTER TABLE public.lockers
  ADD COLUMN IF NOT EXISTS board_address text DEFAULT '',
  ADD COLUMN IF NOT EXISTS board_port integer DEFAULT 4370;
