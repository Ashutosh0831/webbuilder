DO $$ BEGIN
  CREATE TYPE page_approval_status AS ENUM ('draft', 'in_review', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE pages
  ADD COLUMN IF NOT EXISTS approval_status page_approval_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS assigned_reviewer_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS review_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_comment text;

CREATE TABLE IF NOT EXISTS page_review_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  page_id uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  page_version integer NOT NULL,
  action text NOT NULL CHECK (action IN ('submitted', 'resubmitted', 'approved', 'rejected', 'assigned')),
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  assigned_reviewer_id uuid REFERENCES users(id) ON DELETE SET NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS page_review_history_page_created_idx
  ON page_review_history (page_id, created_at);
CREATE INDEX IF NOT EXISTS page_review_history_reviewer_idx
  ON page_review_history (assigned_reviewer_id, created_at);
