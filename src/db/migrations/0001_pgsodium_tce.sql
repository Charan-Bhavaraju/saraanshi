-- ─────────────────────────────────────────────────────────────────────────────
-- Saaranshi — pgsodium Transparent Column Encryption for contacts.real_name
--
-- PREREQUISITES before running this:
--   1. Go to Supabase Dashboard → Database → Extensions
--   2. Search for "pgsodium" and enable it
--   3. Then run this script in the SQL editor
--
-- After this runs, Supabase auto-creates a `decrypted_contacts` view that
-- exposes `decrypted_real_name` with the plaintext value. The app reads from
-- that view when "Show real name" is tapped on a contact detail page.
--
-- If you skip this migration, real_name is stored as plaintext — still
-- protected by RLS and HTTPS, but not encrypted at the column level.
-- ─────────────────────────────────────────────────────────────────────────────

SELECT pgsodium.create_key(name => 'contacts-real-name-key');

DO $$
DECLARE
  key_id uuid;
BEGIN
  SELECT id INTO key_id
  FROM pgsodium.valid_key
  WHERE name = 'contacts-real-name-key'
  LIMIT 1;

  EXECUTE format(
    'SECURITY LABEL FOR pgsodium ON COLUMN contacts.real_name IS %L',
    'ENCRYPT WITH KEY ID ' || key_id::text ||
    ' ASSOCIATED COLUMN id NONCE id'
  );
END $$;
