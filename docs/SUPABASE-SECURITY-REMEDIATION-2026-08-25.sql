-- Molino Control · Supabase security remediation draft
-- IMPORTANT: audit draft only. Do not execute blindly.
-- The critical RLS change requires validating the import flow and policies first.

-- 1) Critical: enable RLS on private import tokens.
-- ALTER TABLE private.maestro_import_tokens ENABLE ROW LEVEL SECURITY;

-- 2) Recommended hardening for the normalization function.
-- ALTER FUNCTION public.norm_cliente_text(text) SET search_path = pg_catalog, public;

-- 3) Recommended privilege review.
-- Revoke EXECUTE from anon/authenticated for SECURITY DEFINER RPCs that are
-- not intentionally public. Grant only the role required by the application.
-- Exact GRANT/REVOKE statements must be finalized after validating the
-- import, health, report and synchronization call paths.

-- 4) Performance RLS optimization pattern:
-- Replace auth.uid() in policy predicates with (select auth.uid()).
-- Do not change policy semantics while applying this optimization.

-- 5) Auth hardening:
-- Enable Supabase Auth leaked-password protection in the project settings.
