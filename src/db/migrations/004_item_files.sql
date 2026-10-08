-- Numbered 004: some data folders already reached version 3 with an earlier (since removed) migration,
-- so a new "003" would be skipped there.
-- Reviews and list items can hold any file (videos, PDFs, text…) next to their images.
-- Existing rows are images; only images can be the cover.

ALTER TABLE images ADD COLUMN file_type TEXT NOT NULL DEFAULT 'image';

-- Original file name (for the file icon, extension and preview); NULL for rows saved before this.
ALTER TABLE images ADD COLUMN file_name TEXT;

ALTER TABLE images ADD COLUMN file_size INTEGER;
