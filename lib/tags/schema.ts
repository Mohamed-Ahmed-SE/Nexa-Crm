import { z } from "zod";

export const tagNameSchema = z.string().trim().min(1, "Enter a tag name.").max(80, "Tag names must be 80 characters or fewer.");
export const tagIdSchema = z.string().uuid("Choose a valid tag.");

export const createTagSchema = z.object({ name: tagNameSchema });
export const renameTagSchema = z.object({ id: tagIdSchema, name: tagNameSchema });
