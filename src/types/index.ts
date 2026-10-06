// Shared domain types used across db/, services/, components/ and pages/.

export type ID = string;

/** ISO date string, YYYY-MM-DD. */
export type DateString = string;
/** ISO timestamp string. */
export type Timestamp = string;

export interface Tag {
  id: ID;
  name: string;
  slug: string;
  createdAt: Timestamp;
  reviewCount: number;
}

export interface MediaList {
  id: ID;
  name: string;
  slug: string;
  createdAt: Timestamp;
  itemCount: number;
}

export type ImageOwnerType = "review" | "list_item";

/** An image stored in the data folder. Paths are relative to the root folder, using "/". */
export interface MediaImage {
  id: ID;
  path: string;
  thumbnailPath: string;
  isCover: boolean;
  position: number;
}

export interface Review {
  id: ID;
  tagId: ID;
  title: string;
  reviewDate: DateString;
  /** 0–10, displayed as grade / 2 stars. */
  grade: number;
  reviewText: string;
  images: MediaImage[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ListItem {
  id: ID;
  listId: ID;
  title: string;
  addedDate: DateString;
  description: string;
  images: MediaImage[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * An image in an edit form, before it is persisted.
 * - stored: already inside the data folder (may live in another item's folder, e.g. "mark as done")
 * - new: bytes picked/dropped by the user, not written yet
 * - default: one of the built-in placeholders in defaults/ (never copied or deleted)
 */
export type ImageDraft =
  | { key: string; kind: "stored"; path: string; thumbnailPath: string }
  | { key: string; kind: "new"; bytes: Uint8Array; fileName: string; previewUrl: string }
  | { key: string; kind: "default"; path: string };

export interface ImageSelection {
  drafts: ImageDraft[];
  coverKey: string;
}

export interface ReviewInput {
  tagId: ID;
  title: string;
  reviewDate: DateString;
  grade: number;
  reviewText: string;
  images: ImageSelection;
}

export interface ListItemInput {
  listId: ID;
  title: string;
  addedDate: DateString;
  description: string;
  images: ImageSelection;
}

export type ReviewSortField = "reviewDate" | "grade" | "title" | "createdAt";
export type SortDirection = "asc" | "desc";

export interface ReviewFilters {
  text: string;
  tagIds: ID[];
  gradeMin: number;
  gradeMax: number;
  dateFrom: DateString | "";
  dateTo: DateString | "";
  sortBy: ReviewSortField;
  sortDir: SortDirection;
}

export interface DefaultImage {
  /** Relative path, e.g. "defaults/book.svg". */
  path: string;
  label: string;
}

// ---------------------------------------------------------------- references

export type FileType = "image" | "video" | "text" | "other";

/** Tag for references only (separate from review tags and lists). */
export interface RefTag {
  id: ID;
  name: string;
  createdAt: Timestamp;
  refCount: number;
}

export interface Reference {
  id: ID;
  title: string;
  /** Stored name inside references/, e.g. "<id>.mp4". */
  fileName: string;
  originalFileName: string;
  fileType: FileType;
  fileSize: number;
  notes: string;
  sourceUrl: string;
  /** Relative path, or null when there is no thumbnail (text/other files, undecodable media). */
  thumbnailPath: string | null;
  /** First part of the text for text files (card preview). */
  textPreview: string | null;
  tagIds: ID[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ReferenceUpdate {
  title: string;
  notes: string;
  sourceUrl: string;
  tagIds: ID[];
}

/** A file on the user's PC waiting to be imported. */
export interface ImportSource {
  /** Absolute path of the original (only read, never moved or modified). */
  path: string;
  name: string;
  size: number;
  fileType: FileType;
}

export interface ImportProgress {
  done: number;
  total: number;
  bytesDone: number;
  bytesTotal: number;
  current: string;
}

export type RefSortField = "createdAt" | "title" | "fileSize" | "random";
