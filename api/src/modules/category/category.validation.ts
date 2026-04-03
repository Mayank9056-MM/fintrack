import { z } from "zod";
import { CategoryType } from "./category.constants";

export const CreateCategorySchema = z.object({
  name: z
    .string({ error: "Category name is required" })
    .min(2, "Name must be at least 2 characters")
    .max(60, "Name must be at most 60 characters")
    .trim(),

  type: z.enum([CategoryType.INCOME, CategoryType.EXPENSE, CategoryType.BOTH], {
    error: () => ({
      message: `Type must be one of: ${Object.values(CategoryType).join(", ")}`,
    }),
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
      "Color must be a valid hex code"
    )
    .optional(),

  icon: z
    .string()
    .max(50, "Icon name must be at most 50 characters")
    .trim()
    .optional(), // Icon identifier, e.g. "shopping-cart"

  isSystem: z.boolean().default(false), // System categories cannot be deleted
});

export const UpdateCategorySchema = CreateCategorySchema.omit({
  isSystem: true,
})
  .partial()
  .strict();

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
