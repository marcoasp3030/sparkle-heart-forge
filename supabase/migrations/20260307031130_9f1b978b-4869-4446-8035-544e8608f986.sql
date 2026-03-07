
-- Departments table
CREATE TABLE public.departamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT DEFAULT '',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Sectors table
CREATE TABLE public.setores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  departamento_id UUID REFERENCES public.departamentos(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  descricao TEXT DEFAULT '',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Employees/Clients table (funcionarios_clientes)
CREATE TABLE public.funcionarios_clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  departamento_id UUID REFERENCES public.departamentos(id) ON DELETE SET NULL,
  setor_id UUID REFERENCES public.setores(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  cargo TEXT DEFAULT '',
  tipo TEXT NOT NULL DEFAULT 'funcionario' CHECK (tipo IN ('funcionario', 'cliente')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.departamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funcionarios_clientes ENABLE ROW LEVEL SECURITY;

-- RLS: Departamentos
CREATE POLICY "Superadmins manage all departamentos"
  ON public.departamentos FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'superadmin')
  WITH CHECK (get_user_role(auth.uid()) = 'superadmin');

CREATE POLICY "Admins manage own company departamentos"
  ON public.departamentos FOR ALL TO authenticated
  USING (
    get_user_role(auth.uid()) = 'admin'
    AND company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid())
  )
  WITH CHECK (
    get_user_role(auth.uid()) = 'admin'
    AND company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid())
  );

CREATE POLICY "Users view own company departamentos"
  ON public.departamentos FOR SELECT TO authenticated
  USING (company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()));

-- RLS: Setores
CREATE POLICY "Superadmins manage all setores"
  ON public.setores FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'superadmin')
  WITH CHECK (get_user_role(auth.uid()) = 'superadmin');

CREATE POLICY "Admins manage own company setores"
  ON public.setores FOR ALL TO authenticated
  USING (
    get_user_role(auth.uid()) = 'admin'
    AND company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid())
  )
  WITH CHECK (
    get_user_role(auth.uid()) = 'admin'
    AND company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid())
  );

CREATE POLICY "Users view own company setores"
  ON public.setores FOR SELECT TO authenticated
  USING (company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()));

-- RLS: Funcionarios/Clientes
CREATE POLICY "Superadmins manage all funcionarios_clientes"
  ON public.funcionarios_clientes FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'superadmin')
  WITH CHECK (get_user_role(auth.uid()) = 'superadmin');

CREATE POLICY "Admins manage own company funcionarios_clientes"
  ON public.funcionarios_clientes FOR ALL TO authenticated
  USING (
    get_user_role(auth.uid()) = 'admin'
    AND company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid())
  )
  WITH CHECK (
    get_user_role(auth.uid()) = 'admin'
    AND company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid())
  );

CREATE POLICY "Users view own company funcionarios_clientes"
  ON public.funcionarios_clientes FOR SELECT TO authenticated
  USING (company_id IN (SELECT p.company_id FROM public.profiles p WHERE p.user_id = auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_departamentos_updated_at BEFORE UPDATE ON public.departamentos FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_setores_updated_at BEFORE UPDATE ON public.setores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_funcionarios_clientes_updated_at BEFORE UPDATE ON public.funcionarios_clientes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
