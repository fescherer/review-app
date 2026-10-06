-- References: a flat library of files in <root>/references/, organized by free-form tags.
-- Reference tags live only in the database (no folders) and are separate from review tags.

CREATE TABLE ref_tags (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL COLLATE NOCASE UNIQUE,
  created_at  TEXT NOT NULL
);

CREATE TABLE refs (
  id                  TEXT PRIMARY KEY,
  title               TEXT NOT NULL,
  file_name           TEXT NOT NULL UNIQUE,
  original_file_name  TEXT NOT NULL,
  file_type           TEXT NOT NULL CHECK (file_type IN ('image', 'video', 'text', 'other')),
  file_size           INTEGER NOT NULL DEFAULT 0,
  notes               TEXT NOT NULL DEFAULT '',
  source_url          TEXT NOT NULL DEFAULT '',
  thumbnail_path      TEXT,
  text_content        TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE TABLE ref_tag_links (
  ref_id  TEXT NOT NULL REFERENCES refs(id) ON DELETE CASCADE,
  tag_id  TEXT NOT NULL REFERENCES ref_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (ref_id, tag_id)
);

CREATE INDEX idx_ref_tag_links_tag ON ref_tag_links(tag_id);
