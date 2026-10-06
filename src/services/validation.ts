import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date (YYYY-MM-DD).")
  .refine((s) => !Number.isNaN(Date.parse(s)), "Use a valid date.");

export const nameSchema = z
  .string()
  .trim()
  .min(1, "Name is required.")
  .max(60, "Name must be at most 60 characters.");

const imageSelectionSchema = z
  .object({
    drafts: z.array(z.any()).min(1, "Add at least one image (or pick a default cover)."),
    coverKey: z.string(),
  })
  .refine((s) => s.drafts.some((d: { key: string }) => d.key === s.coverKey), "Pick a cover image.");

export const reviewInputSchema = z.object({
  tagId: z.string().min(1, "Pick a tag."),
  title: z.string().trim().min(1, "Title is required.").max(300, "Title is too long."),
  reviewDate: isoDate,
  grade: z.number().int().min(0, "Grade must be 0–10.").max(10, "Grade must be 0–10."),
  reviewText: z.string().max(200_000),
  images: imageSelectionSchema,
});

export const listItemInputSchema = z.object({
  listId: z.string().min(1, "Pick a list."),
  title: z.string().trim().min(1, "Title is required.").max(300, "Title is too long."),
  addedDate: isoDate,
  description: z.string().max(50_000),
  images: imageSelectionSchema,
});

export const referenceUpdateSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(300, "Title is too long."),
  notes: z.string().max(100_000),
  sourceUrl: z
    .string()
    .trim()
    .max(2000)
    .refine((s) => !s || /^https?:\/\/\S+$/i.test(s), "Source URL must start with http:// or https://."),
  tagIds: z.array(z.string()),
});

/** Parses with zod and throws a single readable error. */
export function validate<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const res = schema.safeParse(value);
  if (!res.success) throw new ValidationError(res.error.issues.map((i) => i.message).join("\n"));
  return res.data;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
