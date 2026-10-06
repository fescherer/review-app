import * as imagesDb from "../db/images";
import * as db from "../db/reviews";
import { newId, nowIso } from "../lib/util";
import type { ID, Review, ReviewFilters, ReviewInput } from "../types";
import { joinRel, removePath } from "./fileSystem";
import { deleteUnusedImageFiles, persistImages } from "./images";
import { getTag, tagFolder } from "./tags";
import { reviewInputSchema, validate } from "./validation";

export const DEFAULT_FILTERS: ReviewFilters = {
  text: "",
  tagIds: [],
  gradeMin: 0,
  gradeMax: 10,
  dateFrom: "",
  dateTo: "",
  sortBy: "reviewDate",
  sortDir: "desc",
};

export const searchReviews = db.searchReviews;

export async function getReview(id: ID): Promise<Review> {
  const review = await db.reviewById(id);
  if (!review) throw new Error("Review not found.");
  return review;
}

async function reviewFolder(tagId: ID, reviewId: ID): Promise<string> {
  return joinRel(tagFolder(await getTag(tagId)), reviewId);
}

export async function createReview(input: ReviewInput): Promise<Review> {
  const data = validate(reviewInputSchema, input);
  const id = newId();
  const folder = await reviewFolder(data.tagId, id);
  const images = await persistImages(folder, input.images);
  const now = nowIso();
  const review: Review = {
    id,
    tagId: data.tagId,
    title: data.title,
    reviewDate: data.reviewDate,
    grade: data.grade,
    reviewText: data.reviewText,
    images,
    createdAt: now,
    updatedAt: now,
  };
  try {
    await db.insertReview(review);
    await imagesDb.replaceImages("review", id, images);
  } catch (e) {
    await db.deleteReview(id).catch(() => undefined);
    await imagesDb.deleteImagesOf("review", id).catch(() => undefined);
    throw e;
  }
  return review;
}

export async function updateReview(id: ID, input: ReviewInput): Promise<Review> {
  const data = validate(reviewInputSchema, input);
  const previous = await getReview(id);
  const oldFolder = await reviewFolder(previous.tagId, id);
  const folder = await reviewFolder(data.tagId, id);
  const images = await persistImages(folder, input.images);
  const updated: Review = { ...previous, ...data, images, updatedAt: nowIso() };
  await db.updateReview(updated);
  await imagesDb.replaceImages("review", id, images);
  await deleteUnusedImageFiles(previous.images, images);
  if (oldFolder !== folder) await removePath(oldFolder).catch(() => undefined);
  return updated;
}

/** Deletes the review and its image folder. */
export async function deleteReview(id: ID): Promise<void> {
  const review = await getReview(id);
  const folder = await reviewFolder(review.tagId, id);
  await imagesDb.deleteImagesOf("review", id);
  await db.deleteReview(id);
  await removePath(folder);
}
