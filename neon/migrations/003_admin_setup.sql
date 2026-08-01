-- Run once in the Neon SQL Editor after the first administrator completes Google signup.
-- Replace the email address with the Google account that should administer the intranet.

update public.app_users
set role = 'admin', updated_at = now()
where email = 'ADMIN_GOOGLE_EMAIL@example.com';
