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
--   * deletion: users and cases have NO delete policy (denied by default).
--                       Documents are different: documents_delete exists for case
--                       access and the evidence vault UI/API removes documents via
--                       the service role (pre-existing, unchanged here). This admin
--                       panel adds no delete capability at all.
--
-- This file adds the lockout guards from the admin plan, corrected to this
-- schema (the original predicate `id != auth.uid()` was a no-op: users.id is
-- an internal UUID and never equals auth.uid()):
--   1. admins cannot use the admin update policy on their own row
--   2. nobody can change their OWN role or is_active via any path
-- ============================================================================

-- 1. Admin policy: exclude the admin's own row entirely.
--    Note: users_update_own (auth_id = auth.uid()) still matches a user's own
--    row under permissive policy OR-ing, so it remains the path for self-edits
--    (name, avatar). Privileged columns (role, is_active) are blocked for
--    self-edits by the trigger below — that trigger is the authoritative guard.
--    Scope: is_firm_admin() (the existing helper) has no firm_id predicate,
--    same as the pre-existing users/cases admin policies; multi-firm isolation
--    is not implemented in this app (no firms table exists).
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
