-- Initial schema. Image paths are always relative to the data folder root.

CREATE TABLE tags (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL COLLATE NOCASE UNIQUE,
  slug        TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL
);

CREATE TABLE reviews (
  id           TEXT PRIMARY KEY,
  tag_id       TEXT NOT NULL REFERENCES tags(id),
  title        TEXT NOT NULL,
  review_date  TEXT NOT NULL,
  grade        INTEGER NOT NULL CHECK (grade BETWEEN 0 AND 10),
  review_text  TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE INDEX idx_reviews_tag ON reviews(tag_id);

CREATE TABLE lists (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL COLLATE NOCASE UNIQUE,
  slug        TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL
);

CREATE TABLE list_items (
  id           TEXT PRIMARY KEY,
  list_id      TEXT NOT NULL REFERENCES lists(id),
  title        TEXT NOT NULL,
  added_date   TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE INDEX idx_list_items_list ON list_items(list_id);

CREATE TABLE images (
  id              TEXT PRIMARY KEY,
  owner_type      TEXT NOT NULL CHECK (owner_type IN ('review', 'list_item')),
  owner_id        TEXT NOT NULL,
  path            TEXT NOT NULL,
  thumbnail_path  TEXT NOT NULL,
  is_cover        INTEGER NOT NULL DEFAULT 0,
  position        INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_images_owner ON images(owner_type, owner_id);
