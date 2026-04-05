import { z } from "zod";
import { CategoryType } from "./category.constants";

// Create

export const CreateCategorySchema = z.object({
  name: z
    .string({ error: "Category name is required" })
    .min(2, "Name must be at least 2 characters")
    .max(60, "Name must be at most 60 characters")
    .trim(),

  type: z.enum([CategoryType.INCOME, CategoryType.EXPENSE, CategoryType.BOTH], {
    error: `Type must be one of: ${Object.values(CategoryType).join(", ")}`,
  }),

  description: z
    .string()
    .max(200, "Description must be at most 200 characters")
    .trim()
    .optional(),

  color: z
    .string()
    .regex(
      /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/,
      "Color must be a valid hex code (e.g. #FF5733)"
    )
    .optional(),

  icon: z
    .string()
    .max(50, "Icon name must be at most 50 characters")
    .trim()
    .optional(),
});

// Update

export const UpdateCategorySchema = CreateCategorySchema.partial().strict();

// Filter / list query

export const FilterCategorySchema = z.object({
  type: z
    .enum([CategoryType.INCOME, CategoryType.EXPENSE, CategoryType.BOTH])
    .optional(),

  includeSystem: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .default(true),

  search: z.string().max(60).trim().optional(),

  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
