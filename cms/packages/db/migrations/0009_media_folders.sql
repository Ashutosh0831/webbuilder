ALTER TABLE media
  ADD COLUMN IF NOT EXISTS folder text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS media_site_folder_idx
  ON media (site_id, folder);
