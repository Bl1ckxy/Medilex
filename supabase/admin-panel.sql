-- ============================================================================
-- MediLex — Admin panel policy guard (idempotent, additive)
-- ============================================================================
-- The /dashboard/admin panel runs on EXISTING infrastructure; no new columns:
--   * users.role        user_role enum ('firm_admin','senior_partner',
--                       'associate','paralegal')  -> panel admin = 'firm_admin'
--   * users.is_active   boolean                    -> panel status = active/suspended
--   * users_select_admin / users_update_admin      -> is_firm_admin() (already in
--                       rls_policies.sql: admins read + update firm users)
--   * cases_select / cases_update include is_firm_admin()  -> admin case
--                       read + metadata update (already granted)
--   * no DELETE policies on users / cases / documents -> deletion is denied
--                       by default (chain of custody enforced at the DB)
--
-- This file adds the lockout guards from the admin plan, corrected to this
-- schema (the original predicate `id != auth.uid()` was a no-op: users.id is
-- an internal UUID and never equals auth.uid()):
--   1. admins cannot use the admin update policy on their own row
--   2. nobody can change their OWN role or is_active via any path
-- ============================================================================

-- 1. Admin policy: exclude the admin's own row entirely.
DROP POLICY IF EXISTS users_update_admin ON users;
CREATE POLICY users_update_admin ON users
    FOR UPDATE
    USING (is_firm_admin())
    WITH CHECK (is_firm_admin() AND auth_id <> auth.uid());

-- 2. Lockout guard at the table level (covers the panel, the API and any
--    client): self rows may be updated (name, avatar) but never privileged
--    columns. Admins promote/demote/suspend OTHER users only.
CREATE OR REPLACE FUNCTION users_block_self_privilege_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.auth_id = auth.uid() AND (
        NEW.role IS DISTINCT FROM OLD.role
        OR NEW.is_active IS DISTINCT FROM OLD.is_active
    ) THEN
        RAISE EXCEPTION 'Cannot change your own role or account status';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_users_block_self_privilege ON users;
CREATE TRIGGER trg_users_block_self_privilege
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION users_block_self_privilege_change();

-- Promote yourself once (SQL Editor), then sign out and back in:
--   UPDATE users SET role = 'firm_admin' WHERE email = 'you@example.com';
--
-- Verify admin visibility of the whole team (expect >1 row for an admin):
--   SELECT email, role, is_active FROM users ORDER BY created_at DESC;
