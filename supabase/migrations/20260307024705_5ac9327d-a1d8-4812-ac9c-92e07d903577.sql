
-- Lockers table: each locker unit
CREATE TABLE public.lockers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text NOT NULL DEFAULT '',
  orientation text NOT NULL DEFAULT 'vertical' CHECK (orientation IN ('vertical', 'horizontal')),
  columns integer NOT NULL DEFAULT 1,
  rows integer NOT NULL DEFAULT 4,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Locker doors: individual doors within a locker
CREATE TABLE public.locker_doors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  locker_id uuid NOT NULL REFERENCES public.lockers(id) ON DELETE CASCADE,
  door_number integer NOT NULL,
  label text,
  size text NOT NULL DEFAULT 'medium' CHECK (size IN ('small', 'medium', 'large')),
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'reserved')),
  occupied_by uuid REFERENCES public.profiles(user_id),
  occupied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (locker_id, door_number)
);

-- Enable RLS
ALTER TABLE public.lockers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locker_doors ENABLE ROW LEVEL SECURITY;

-- Lockers: everyone authenticated can view
CREATE POLICY "Authenticated users can view lockers"
  ON public.lockers FOR SELECT TO authenticated
  USING (true);

-- Lockers: only admins/superadmins can manage
CREATE POLICY "Admins can manage lockers"
  ON public.lockers FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'superadmin'))
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'superadmin'));

-- Doors: everyone authenticated can view
CREATE POLICY "Authenticated users can view doors"
  ON public.locker_doors FOR SELECT TO authenticated
  USING (true);

-- Doors: admins can do everything
CREATE POLICY "Admins can manage doors"
  ON public.locker_doors FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) IN ('admin', 'superadmin'))
  WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'superadmin'));

-- Doors: users can occupy/release their own
CREATE POLICY "Users can reserve available doors"
  ON public.locker_doors FOR UPDATE TO authenticated
  USING (status = 'available' OR occupied_by = auth.uid())
  WITH CHECK (occupied_by = auth.uid() OR occupied_by IS NULL);
