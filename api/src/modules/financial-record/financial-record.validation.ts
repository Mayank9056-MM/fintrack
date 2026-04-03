import mongoose from "mongoose";
import {
  RecurringInterval,
  TransactionType,
} from "./financial-record.constant";
import { z } from "zod";

export const CreateFinancialRecordSchema = z.object({
  amount: z
    .number({ error: "Amount is required" })
    .positive("Amount must be a positive number")
    .multipleOf(0.01, "Amount cannot have more than 2 decimal places")
    .max(999_999_999.99, "Amount is too large"),

  type: z.enum([TransactionType.INCOME, TransactionType.EXPENSE], {
    error: () => ({
      message: `Type must be one of: ${Object.values(TransactionType).join(", ")}`,
    }),
  }),

  category: z
    .string({ error: "Category ID is required" })
    .refine((val) => mongoose.isValidObjectId(val), {
      message: "Invalid category ID",
    }),

  date: z.iso
    .datetime({ message: "Date must be a valid ISO 8601 datetime" })
    .or(z.date())
    .transform((val) => new Date(val)),

  notes: z
    .string()
    .max(500, "Notes must be at most 500 characters")
    .trim()
    .optional(),

  tags: z
    .array(z.string().trim().max(30, "Tag must be at most 30 characters"))
    .max(10, "You can have at most 10 tags")
    .default([]),

  currency: z
    .string()
    .length(3, "Currency must be a 3-letter ISO code (e.g., USD)")
    .toUpperCase()
    .default("USD"),

  recurring: z
    .enum(
      [
        RecurringInterval.NONE,
        RecurringInterval.DAILY,
        RecurringInterval.WEEKLY,
        RecurringInterval.MONTHLY,
        RecurringInterval.YEARLY,
      ],
      {
        error: () => ({
          message: `Recurring must be one of: ${Object.values(RecurringInterval).join(", ")}`,
        }),
      }
    )
    .default(RecurringInterval.NONE),
});

export const UpdateFinancialRecordSchema =
  CreateFinancialRecordSchema.partial().strict();

export const FilterFinancialRecordSchema = z
  .object({
    type: z.enum([TransactionType.INCOME, TransactionType.EXPENSE]).optional(),

    category: z
      .string()
      .refine((val) => mongoose.isValidObjectId(val), "Invalid category ID")
      .optional(),

    startDate: z.iso
      .datetime()
      .or(z.date())
      .transform((val) => new Date(val))
      .optional(),

    endDate: z.iso
      .datetime()
      .or(z.date())
      .transform((val) => new Date(val))
      .optional(),

    minAmount: z
      .number()
      .positive("Minimum amount must be positive")
      .optional(),

    maxAmount: z
      .number()
      .positive("Maximum amount must be positive")
      .optional(),

    tags: z.array(z.string().trim()).optional(),

    currency: z.string().length(3).toUpperCase().optional(),

    isDeleted: z.boolean().default(false),

    page: z.number().int().positive().default(1),

    limit: z
      .number()
      .int()
      .positive()
      .max(100, "Limit cannot exceed 100")
      .default(20),

    sortBy: z.enum(["date", "amount", "createdAt"]).default("date"),

    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.startDate <= data.endDate;
      }
      return true;
    },
    {
      message: "startDate must be before or equal to endDate",
      path: ["endDate"],
    }
  )
  .refine(
    (data) => {
      if (data.minAmount !== undefined && data.maxAmount !== undefined) {
        return data.minAmount <= data.maxAmount;
      }
      return true;
    },
    {
      message: "minAmount must be less than or equal to maxAmount",
      path: ["maxAmount"],
    }
  );

export type CreateFinancialRecordInput = z.infer<
  typeof CreateFinancialRecordSchema
>;
export type UpdateFinancialRecordInput = z.infer<
  typeof UpdateFinancialRecordSchema
>;
export type FilterFinancialRecordInput = z.infer<
  typeof FilterFinancialRecordSchema
>;
