ALTER TABLE pages
  ADD COLUMN IF NOT EXISTS scheduled_publish_at timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_unpublish_at timestamptz;

CREATE INDEX IF NOT EXISTS pages_scheduled_publish_idx
  ON pages (scheduled_publish_at)
  WHERE scheduled_publish_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS pages_scheduled_unpublish_idx
  ON pages (scheduled_unpublish_at)
  WHERE scheduled_unpublish_at IS NOT NULL;
