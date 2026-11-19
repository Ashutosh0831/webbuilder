ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS encrypted_key text;

-- Read keys created after this migration are stored encrypted for server-side
-- website generation. Legacy keys remain hash-only and can be rotated by admins.
