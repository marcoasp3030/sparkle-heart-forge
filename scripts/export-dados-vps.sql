-- ============================================
-- SCRIPT DE EXPORTAÇÃO DE DADOS - LOCKER SYSTEM
-- ============================================
-- Este script extrai todos os dados do banco Supabase (Lovable Cloud)
-- e gera INSERTs para importar no PostgreSQL da VPS.
--
-- COMO USAR:
-- 1. Acesse o backend do projeto (Lovable Cloud > Run SQL)
-- 2. Execute cada bloco SELECT abaixo separadamente
-- 3. Copie os resultados
-- 4. Execute os INSERTs gerados no PostgreSQL da VPS
--
-- ORDEM DE EXECUÇÃO OBRIGATÓRIA (respeitar foreign keys):
-- 1. companies
-- 2. company_branding, company_permissions, company_whatsapp, company_notification_templates
-- 3. departamentos
-- 4. setores
-- 5. funcionarios_clientes
-- 6. lockers
-- 7. locker_doors
-- 8. locker_reservations
-- 9. locker_waitlist, renewal_requests
-- 10. platform_settings, platform_settings_history
-- 11. audit_logs
-- 12. notifications
-- ============================================

-- ============================================
-- IMPORTANTE: Migração de Usuários
-- ============================================
-- Os usuários do auth.users do Supabase NÃO podem ser exportados
-- diretamente pois as senhas são gerenciadas pelo Supabase Auth.
--
-- Opções:
-- A) Criar os usuários manualmente na VPS e pedir que redefinam a senha
-- B) Usar o script abaixo para exportar os profiles e criar users na VPS
--    com senha temporária (ex: "MudarSenha123!")
-- ============================================


-- ============================================
-- 1. EXPORTAR PROFILES → USERS + PROFILES na VPS
-- ============================================
-- Execute este SELECT para gerar os comandos de criação de usuários.
-- Cada usuário será criado com senha temporária "MudarSenha123!" 
-- (hash bcrypt abaixo). Peça aos usuários que alterem no primeiro login.

-- Hash bcrypt de "MudarSenha123!" (salt rounds 12):
-- $2a$12$LJ3m4ys3GZvK4qWJZT7OzOTTIG7RNcJpbnU3LFXs9ByO9RLqMe9y2

SELECT format(
  'INSERT INTO users (id, email, password_hash, email_confirmed, created_at, updated_at) VALUES (%L, %L, %L, TRUE, %L, %L) ON CONFLICT (email) DO NOTHING;',
  p.user_id,
  u.email,
  '$2a$12$LJ3m4ys3GZvK4qWJZT7OzOTTIG7RNcJpbnU3LFXs9ByO9RLqMe9y2',
  p.created_at,
  p.updated_at
) AS sql_insert
FROM profiles p
JOIN auth.users u ON u.id = p.user_id
ORDER BY p.created_at;

-- PROFILES
SELECT format(
  'INSERT INTO profiles (id, user_id, full_name, role, company_id, avatar_url, password_changed, created_at, updated_at) VALUES (%L, %L, %L, %L, %L, %L, FALSE, %L, %L) ON CONFLICT (user_id) DO NOTHING;',
  id, user_id, full_name, role, company_id, avatar_url, created_at, updated_at
) AS sql_insert
FROM profiles
ORDER BY created_at;


-- ============================================
-- 2. COMPANIES
-- ============================================
SELECT format(
  'INSERT INTO companies (id, name, type, description, active, cnpj, email, phone, contact_name, address, city, state, created_at, updated_at) VALUES (%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L) ON CONFLICT (id) DO NOTHING;',
  id, name, type, description, active, cnpj, email, phone, contact_name, address, city, state, created_at, updated_at
) AS sql_insert
FROM companies
ORDER BY created_at;


-- ============================================
-- 3. COMPANY_BRANDING
-- ============================================
SELECT format(
  'INSERT INTO company_branding (id, company_id, logo_url, sidebar_logo_url, favicon_url, login_bg_url, platform_name, login_title, login_subtitle, theme_colors, created_at, updated_at) VALUES (%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L) ON CONFLICT (company_id) DO NOTHING;',
  id, company_id, logo_url, sidebar_logo_url, favicon_url, login_bg_url, platform_name, login_title, login_subtitle, theme_colors, created_at, updated_at
) AS sql_insert
FROM company_branding
ORDER BY created_at;


-- ============================================
-- 4. COMPANY_PERMISSIONS
-- ============================================
SELECT format(
  'INSERT INTO company_permissions (id, company_id, permission, enabled, created_at, updated_at) VALUES (%L, %L, %L, %L, %L, %L) ON CONFLICT (id) DO NOTHING;',
  id, company_id, permission, enabled, created_at, updated_at
) AS sql_insert
FROM company_permissions
ORDER BY created_at;


-- ============================================
-- 5. COMPANY_WHATSAPP
-- ============================================
SELECT format(
  'INSERT INTO company_whatsapp (id, company_id, instance_name, instance_token, phone_number, status, created_at, updated_at) VALUES (%L, %L, %L, %L, %L, %L, %L, %L) ON CONFLICT (company_id) DO NOTHING;',
  id, company_id, instance_name, instance_token, phone_number, status, created_at, updated_at
) AS sql_insert
FROM company_whatsapp
ORDER BY created_at;


-- ============================================
-- 6. COMPANY_NOTIFICATION_TEMPLATES
-- ============================================
SELECT format(
  'INSERT INTO company_notification_templates (id, company_id, type, channel, template_text, footer, active, created_at, updated_at) VALUES (%L, %L, %L, %L, %L, %L, %L, %L, %L) ON CONFLICT (id) DO NOTHING;',
  id, company_id, type, channel, template_text, footer, active, created_at, updated_at
) AS sql_insert
FROM company_notification_templates
ORDER BY created_at;


-- ============================================
-- 7. DEPARTAMENTOS
-- ============================================
SELECT format(
  'INSERT INTO departamentos (id, company_id, nome, descricao, ativo, created_at, updated_at) VALUES (%L, %L, %L, %L, %L, %L, %L) ON CONFLICT (id) DO NOTHING;',
  id, company_id, nome, descricao, ativo, created_at, updated_at
) AS sql_insert
FROM departamentos
ORDER BY created_at;


-- ============================================
-- 8. SETORES
-- ============================================
SELECT format(
  'INSERT INTO setores (id, company_id, departamento_id, nome, descricao, ativo, created_at, updated_at) VALUES (%L, %L, %L, %L, %L, %L, %L, %L) ON CONFLICT (id) DO NOTHING;',
  id, company_id, departamento_id, nome, descricao, ativo, created_at, updated_at
) AS sql_insert
FROM setores
ORDER BY created_at;


-- ============================================
-- 9. FUNCIONARIOS_CLIENTES
-- ============================================
SELECT format(
  'INSERT INTO funcionarios_clientes (id, company_id, user_id, departamento_id, setor_id, nome, email, telefone, cargo, tipo, matricula, avatar_url, ativo, notification_whatsapp, notification_email, notification_renewal, notification_expiry, created_at, updated_at) VALUES (%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L) ON CONFLICT (id) DO NOTHING;',
  id, company_id, user_id, departamento_id, setor_id, nome, email, telefone, cargo, tipo, matricula, avatar_url, ativo, notification_whatsapp, notification_email, notification_renewal, notification_expiry, created_at, updated_at
) AS sql_insert
FROM funcionarios_clientes
ORDER BY created_at;


-- ============================================
-- 10. LOCKERS
-- ============================================
SELECT format(
  'INSERT INTO lockers (id, company_id, name, location, rows, columns, orientation, created_at, updated_at) VALUES (%L, %L, %L, %L, %L, %L, %L, %L, %L) ON CONFLICT (id) DO NOTHING;',
  id, company_id, name, location, rows, columns, orientation, created_at, updated_at
) AS sql_insert
FROM lockers
ORDER BY created_at;


-- ============================================
-- 11. LOCKER_DOORS
-- ============================================
SELECT format(
  'INSERT INTO locker_doors (id, locker_id, door_number, label, size, status, usage_type, occupied_by, occupied_by_person, occupied_at, expires_at, scheduled_reservation_id, created_at, updated_at) VALUES (%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L) ON CONFLICT (id) DO NOTHING;',
  id, locker_id, door_number, label, size, status, usage_type, occupied_by, occupied_by_person, occupied_at, expires_at, scheduled_reservation_id, created_at, updated_at
) AS sql_insert
FROM locker_doors
ORDER BY locker_id, door_number;


-- ============================================
-- 12. LOCKER_RESERVATIONS
-- ============================================
SELECT format(
  'INSERT INTO locker_reservations (id, locker_id, door_id, reserved_by, person_id, status, usage_type, starts_at, expires_at, released_at, renewed_count, expiry_notified, notes, created_at, updated_at) VALUES (%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L) ON CONFLICT (id) DO NOTHING;',
  id, locker_id, door_id, reserved_by, person_id, status, usage_type, starts_at, expires_at, released_at, renewed_count, expiry_notified, notes, created_at, updated_at
) AS sql_insert
FROM locker_reservations
ORDER BY created_at;


-- ============================================
-- 13. LOCKER_WAITLIST
-- ============================================
SELECT format(
  'INSERT INTO locker_waitlist (id, company_id, locker_id, person_id, requested_by, preferred_size, status, notified_at, created_at, updated_at) VALUES (%L, %L, %L, %L, %L, %L, %L, %L, %L, %L) ON CONFLICT (id) DO NOTHING;',
  id, company_id, locker_id, person_id, requested_by, preferred_size, status, notified_at, created_at, updated_at
) AS sql_insert
FROM locker_waitlist
ORDER BY created_at;


-- ============================================
-- 14. RENEWAL_REQUESTS
-- ============================================
SELECT format(
  'INSERT INTO renewal_requests (id, company_id, door_id, person_id, requested_hours, status, admin_notes, reviewed_by, reviewed_at, created_at, updated_at) VALUES (%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L) ON CONFLICT (id) DO NOTHING;',
  id, company_id, door_id, person_id, requested_hours, status, admin_notes, reviewed_by, reviewed_at, created_at, updated_at
) AS sql_insert
FROM renewal_requests
ORDER BY created_at;


-- ============================================
-- 15. NOTIFICATIONS
-- ============================================
SELECT format(
  'INSERT INTO notifications (id, user_id, title, message, type, read, created_at) VALUES (%L, %L, %L, %L, %L, %L, %L) ON CONFLICT (id) DO NOTHING;',
  id, user_id, title, message, type, read, created_at
) AS sql_insert
FROM notifications
ORDER BY created_at;


-- ============================================
-- 16. PLATFORM_SETTINGS
-- ============================================
SELECT format(
  'INSERT INTO platform_settings (id, key, value, created_at, updated_at) VALUES (%L, %L, %L, %L, %L) ON CONFLICT (key) DO NOTHING;',
  id, key, value, created_at, updated_at
) AS sql_insert
FROM platform_settings
ORDER BY created_at;


-- ============================================
-- 17. PLATFORM_SETTINGS_HISTORY
-- ============================================
SELECT format(
  'INSERT INTO platform_settings_history (id, setting_key, value, changed_by, created_at) VALUES (%L, %L, %L, %L, %L) ON CONFLICT (id) DO NOTHING;',
  id, setting_key, value, changed_by, created_at
) AS sql_insert
FROM platform_settings_history
ORDER BY created_at;


-- ============================================
-- 18. AUDIT_LOGS (opcional - pode ser grande)
-- ============================================
SELECT format(
  'INSERT INTO audit_logs (id, user_id, company_id, action, resource_type, resource_id, category, details, ip_address, user_agent, created_at) VALUES (%L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L) ON CONFLICT (id) DO NOTHING;',
  id, user_id, company_id, action, resource_type, resource_id, category, details, ip_address, user_agent, created_at
) AS sql_insert
FROM audit_logs
ORDER BY created_at;


-- ============================================
-- 19. LOGIN_ATTEMPTS (opcional - dados temporários)
-- ============================================
-- Normalmente não é necessário migrar login_attempts.
-- Se quiser, descomente:
--
-- SELECT format(
--   'INSERT INTO login_attempts (id, email, success, ip_address, created_at) VALUES (%L, %L, %L, %L, %L) ON CONFLICT (id) DO NOTHING;',
--   id, email, success, ip_address, created_at
-- ) AS sql_insert
-- FROM login_attempts
-- ORDER BY created_at;


-- ============================================
-- NOTAS IMPORTANTES
-- ============================================
--
-- 1. ORDEM: Execute os INSERTs na VPS NA ORDEM listada acima
--    (companies antes de departamentos, departamentos antes de setores, etc.)
--
-- 2. SENHAS: Todos os usuários terão senha temporária "MudarSenha123!"
--    Peça que alterem no primeiro login.
--    Para gerar outro hash: node -e "require('bcryptjs').hash('SuaSenha', 12).then(h => console.log(h))"
--
-- 3. STORAGE: Arquivos de avatar e logos precisam ser baixados manualmente
--    dos buckets do Supabase Storage e colocados na pasta uploads/ da VPS.
--    URLs de avatar em company_branding e funcionarios_clientes precisarão
--    ser atualizadas para apontar para o novo servidor.
--
-- 4. scheduled_reservation_id: Se houver referências circulares entre
--    locker_doors e locker_reservations, insira locker_doors primeiro
--    SEM o scheduled_reservation_id, depois faça UPDATE para preencher.
--
-- 5. FOREIGN KEYS TEMPORÁRIAS: Se der erro de FK ao importar, você pode
--    desabilitar temporariamente:
--      SET session_replication_role = 'replica';  -- desabilita FKs
--      ... executar INSERTs ...
--      SET session_replication_role = 'origin';   -- reabilita FKs
-- ============================================
