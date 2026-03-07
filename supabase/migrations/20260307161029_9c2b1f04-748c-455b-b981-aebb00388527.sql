CREATE OR REPLACE FUNCTION public.get_login_lockout_status(_email text)
RETURNS TABLE (
  bloqueado boolean,
  tentativas_restantes integer,
  minutos_restantes integer,
  segundos_restantes integer,
  total_falhas integer,
  nivel text,
  mensagem text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email text := lower(trim(_email));
  v_max_attempts integer := 5;
  v_lockout_seconds integer := 60;
  v_window interval := interval '30 minutes';
  v_falhas integer := 0;
  v_restantes integer := 0;
  v_last_attempt timestamptz;
  v_unlock_at timestamptz;
  v_segundos integer := 0;
BEGIN
  IF v_email IS NULL OR v_email = '' THEN
    RETURN QUERY SELECT false, v_max_attempts, 0, 0, 0, 'info'::text, ''::text;
    RETURN;
  END IF;

  SELECT count(*)::integer, max(created_at)
    INTO v_falhas, v_last_attempt
  FROM public.login_attempts
  WHERE email = v_email
    AND success = false
    AND created_at >= now() - v_window;

  IF v_falhas >= v_max_attempts AND v_last_attempt IS NOT NULL THEN
    v_unlock_at := v_last_attempt + make_interval(secs => v_lockout_seconds);

    IF now() < v_unlock_at THEN
      v_segundos := ceil(extract(epoch from (v_unlock_at - now())))::integer;
      RETURN QUERY
      SELECT
        true,
        0,
        GREATEST(1, ceil(v_segundos::numeric / 60.0)::integer),
        v_segundos,
        v_falhas,
        'bloqueado'::text,
        format('Sua conta foi temporariamente bloqueada por segurança. Aguarde %s segundo(s) antes de tentar novamente.', v_segundos);
      RETURN;
    END IF;
  END IF;

  v_restantes := GREATEST(0, v_max_attempts - v_falhas);

  RETURN QUERY
  SELECT
    false,
    v_restantes,
    0,
    0,
    v_falhas,
    CASE
      WHEN v_falhas <= 2 THEN 'info'
      WHEN v_falhas <= 3 THEN 'aviso'
      WHEN v_falhas <= 4 THEN 'perigo'
      ELSE 'bloqueado'
    END,
    CASE
      WHEN v_falhas = 0 THEN ''
      WHEN v_restantes <= 1 THEN '⚠️ Última tentativa! Após esta, sua conta será bloqueada temporariamente.'
      WHEN v_restantes <= 2 THEN format('Atenção: restam apenas %s tentativas. Verifique se o Caps Lock está desligado e confira seu e-mail.', v_restantes)
      ELSE format('E-mail ou senha incorretos. Você ainda tem %s tentativa(s).', v_restantes)
    END;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_login_attempt(_email text, _success boolean)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  INSERT INTO public.login_attempts (email, success)
  VALUES (lower(trim(_email)), COALESCE(_success, false));
$$;

GRANT EXECUTE ON FUNCTION public.get_login_lockout_status(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_login_attempt(text, boolean) TO anon, authenticated;