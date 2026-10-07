import type { ID, Review, ReviewFilters } from "../types";
import { execute, select } from "./client";
import { imagesByOwner } from "./images";

interface ReviewRow {
  id: string;
  tag_id: string;
  title: string;
  review_date: string;
  grade: number;
  review_text: string;
  created_at: string;
  updated_at: string;
}

const SORT_COLUMNS: Record<ReviewFilters["sortBy"], string> = {
  reviewDate: "review_date",
  grade: "grade",
  title: "title COLLATE NOCASE",
  createdAt: "created_at",
};

async function withImages(rows: ReviewRow[]): Promise<Review[]> {
  // Large result sets: one query for all images is cheaper than a huge IN (...) list.
  const images = await imagesByOwner("review", rows.length > 200 ? undefined : rows.map((r) => r.id));
  return rows.map((r) => ({
    id: r.id,
    tagId: r.tag_id,
    title: r.title,
    reviewDate: r.review_date,
    grade: r.grade,
    reviewText: r.review_text,
    images: images.get(r.id) ?? [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

function escapeLike(text: string): string {
  return text.replace(/[!%_]/g, (c) => "!" + c);
}

export async function searchReviews(f: ReviewFilters): Promise<Review[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  const p = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };

  const text = f.text.trim();
  if (text) {
    const like = p(`%${escapeLike(text)}%`);
    where.push(`(title LIKE ${like} ESCAPE '!' OR review_text LIKE ${like} ESCAPE '!')`);
  }
  if (f.tagIds.length) where.push(`tag_id IN (${f.tagIds.map(p).join(",")})`);

  const dir = f.sortDir === "asc" ? "ASC" : "DESC";
  const sql =
    `SELECT * FROM reviews` +
    (where.length ? ` WHERE ${where.join(" AND ")}` : "") +
    ` ORDER BY ${SORT_COLUMNS[f.sortBy]} ${dir}, created_at ${dir}`;
  return withImages(await select<ReviewRow>(sql, params));
}

export async function allReviews(): Promise<Review[]> {
  return withImages(await select<ReviewRow>("SELECT * FROM reviews ORDER BY review_date DESC"));
}

export async function reviewById(id: ID): Promise<Review | null> {
  const rows = await select<ReviewRow>("SELECT * FROM reviews WHERE id = $1", [id]);
  return rows.length ? (await withImages(rows))[0] : null;
}

export async function reviewIdsByTag(tagId: ID): Promise<ID[]> {
  return (await select<{ id: string }>("SELECT id FROM reviews WHERE tag_id = $1", [tagId])).map((r) => r.id);
}

export async function insertReview(r: Omit<Review, "images">): Promise<void> {
  await execute(
    `INSERT INTO reviews (id, tag_id, title, review_date, grade, review_text, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [r.id, r.tagId, r.title, r.reviewDate, r.grade, r.reviewText, r.createdAt, r.updatedAt],
  );
}

export async function updateReview(r: Omit<Review, "images" | "createdAt">): Promise<void> {
  await execute(
    `UPDATE reviews SET tag_id = $2, title = $3, review_date = $4, grade = $5, review_text = $6, updated_at = $7
     WHERE id = $1`,
    [r.id, r.tagId, r.title, r.reviewDate, r.grade, r.reviewText, r.updatedAt],
  );
}

export async function setReviewTag(id: ID, tagId: ID): Promise<void> {
  await execute("UPDATE reviews SET tag_id = $2 WHERE id = $1", [id, tagId]);
}

export async function deleteReview(id: ID): Promise<void> {
  await execute("DELETE FROM reviews WHERE id = $1", [id]);
}
