
CREATE TABLE IF NOT EXISTS public.comandos_fechadura (
    id SERIAL PRIMARY KEY,
    acao VARCHAR(20) NOT NULL,
    lock_id INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pendente',
    resposta TEXT,
    origem VARCHAR(30) DEFAULT 'web',
    criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    executado_em TIMESTAMPTZ
);

-- RLS: tabela pública na fase inicial, mas preparada para futuro multi-tenant
ALTER TABLE public.comandos_fechadura ENABLE ROW LEVEL SECURITY;

-- Permitir acesso total para authenticated e anon (fase inicial sem auth)
CREATE POLICY "Public read comandos_fechadura" ON public.comandos_fechadura FOR SELECT USING (true);
CREATE POLICY "Public insert comandos_fechadura" ON public.comandos_fechadura FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update comandos_fechadura" ON public.comandos_fechadura FOR UPDATE USING (true) WITH CHECK (true);

-- Index para busca rápida de comandos pendentes
CREATE INDEX idx_comandos_fechadura_status ON public.comandos_fechadura (status, id ASC);
