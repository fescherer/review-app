import type { FileType, ID, Reference } from "../types";
import { execute, select } from "./client";

interface RefRow {
  id: string;
  title: string;
  file_name: string;
  original_file_name: string;
  file_type: FileType;
  file_size: number;
  notes: string;
  source_url: string;
  thumbnail_path: string | null;
  text_preview: string | null;
  created_at: string;
  updated_at: string;
}

const COLUMNS = `id, title, file_name, original_file_name, file_type, file_size, notes, source_url, thumbnail_path,
  substr(text_content, 1, 1200) AS text_preview, created_at, updated_at`;

async function tagIdsByRef(ids?: ID[]): Promise<Map<ID, ID[]>> {
  const rows = ids
    ? ids.length
      ? await select<{ ref_id: string; tag_id: string }>(
          `SELECT ref_id, tag_id FROM ref_tag_links WHERE ref_id IN (${ids.map((_, i) => `$${i + 1}`).join(",")})`,
          ids,
        )
      : []
    : await select<{ ref_id: string; tag_id: string }>("SELECT ref_id, tag_id FROM ref_tag_links");
  const map = new Map<ID, ID[]>();
  for (const r of rows) {
    const list = map.get(r.ref_id) ?? [];
    list.push(r.tag_id);
    map.set(r.ref_id, list);
  }
  return map;
}

function toReference(r: RefRow, tags: Map<ID, ID[]>): Reference {
  return {
    id: r.id,
    title: r.title,
    fileName: r.file_name,
    originalFileName: r.original_file_name,
    fileType: r.file_type,
    fileSize: r.file_size,
    notes: r.notes,
    sourceUrl: r.source_url,
    thumbnailPath: r.thumbnail_path,
    textPreview: r.text_preview,
    tagIds: tags.get(r.id) ?? [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function allReferences(): Promise<Reference[]> {
  const [rows, tags] = await Promise.all([
    select<RefRow>(`SELECT ${COLUMNS} FROM refs ORDER BY created_at DESC`),
    tagIdsByRef(),
  ]);
  return rows.map((r) => toReference(r, tags));
}

export async function referenceById(id: ID): Promise<Reference | null> {
  const rows = await select<RefRow>(`SELECT ${COLUMNS} FROM refs WHERE id = $1`, [id]);
  return rows[0] ? toReference(rows[0], await tagIdsByRef([id])) : null;
}

/** Ids of references whose title, notes, original file name or text content contain `text`. */
export async function searchReferenceIds(text: string): Promise<Set<ID>> {
  const like = `%${text.replace(/[!%_]/g, (c) => "!" + c)}%`;
  const rows = await select<{ id: string }>(
    `SELECT id FROM refs WHERE title LIKE $1 ESCAPE '!' OR notes LIKE $1 ESCAPE '!'
       OR original_file_name LIKE $1 ESCAPE '!' OR text_content LIKE $1 ESCAPE '!'`,
    [like],
  );
  return new Set(rows.map((r) => r.id));
}

export async function insertReference(r: Omit<Reference, "tagIds" | "textPreview">, textContent: string | null): Promise<void> {
  await execute(
    `INSERT INTO refs (id, title, file_name, original_file_name, file_type, file_size, notes, source_url,
                       thumbnail_path, text_content, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      r.id,
      r.title,
      r.fileName,
      r.originalFileName,
      r.fileType,
      r.fileSize,
      r.notes,
      r.sourceUrl,
      r.thumbnailPath,
      textContent,
      r.createdAt,
      r.updatedAt,
    ],
  );
}

export async function updateReference(id: ID, title: string, notes: string, sourceUrl: string, updatedAt: string): Promise<void> {
  await execute("UPDATE refs SET title = $2, notes = $3, source_url = $4, updated_at = $5 WHERE id = $1", [
    id,
    title,
    notes,
    sourceUrl,
    updatedAt,
  ]);
}

export async function setReferenceTags(id: ID, tagIds: ID[]): Promise<void> {
  await execute("DELETE FROM ref_tag_links WHERE ref_id = $1", [id]);
  for (const tagId of new Set(tagIds)) {
    await execute("INSERT OR IGNORE INTO ref_tag_links (ref_id, tag_id) VALUES ($1, $2)", [id, tagId]);
  }
}

export async function deleteReference(id: ID): Promise<void> {
  await execute("DELETE FROM ref_tag_links WHERE ref_id = $1", [id]);
  await execute("DELETE FROM refs WHERE id = $1", [id]);
}
