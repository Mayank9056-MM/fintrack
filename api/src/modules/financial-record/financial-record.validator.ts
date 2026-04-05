import mongoose from "mongoose";
import {
  RecurringInterval,
  TransactionType,
} from "./financial-record.constant";
import { z } from "zod";

// Shared field definitions

const objectIdField = (label: string) =>
  z
    .string({ error: `${label} is required` })
    .refine((val) => mongoose.isValidObjectId(val), {
      message: `Invalid ${label}`,
    });

const isoDateField = (label: string) =>
  z
    .string({ error: `${label} is required` })
    .datetime({ message: `${label} must be a valid ISO 8601 datetime` })
    .transform((val) => new Date(val));

// Create

export const CreateFinancialRecordSchema = z.object({
  amount: z
    .number({ error: "Amount is required" })
    .positive("Amount must be a positive number")
    .multipleOf(0.01, "Amount cannot have more than 2 decimal places")
    .max(999_999_999.99, "Amount is too large"),

  type: z.enum([TransactionType.INCOME, TransactionType.EXPENSE], {
    error: `Type must be one of: ${Object.values(TransactionType).join(", ")}`,
  }),

  category: objectIdField("category ID"),

  date: isoDateField("Date"),

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
        error: `Recurring must be one of: ${Object.values(RecurringInterval).join(", ")}`,
      }
    )
    .default(RecurringInterval.NONE),
});

export type CreateFinancialRecordBody = z.infer<
  typeof CreateFinancialRecordSchema
>;

// Update (all fields optional)

export const UpdateFinancialRecordSchema =
  CreateFinancialRecordSchema.partial().strict();

export type UpdateFinancialRecordBody = z.infer<
  typeof UpdateFinancialRecordSchema
>;

// Filter / list query

export const FilterFinancialRecordSchema = z
  .object({
    type: z.enum([TransactionType.INCOME, TransactionType.EXPENSE]).optional(),

    category: z
      .string()
      .refine((val) => mongoose.isValidObjectId(val), "Invalid category ID")
      .optional(),

    startDate: z.iso
      .datetime()
      .transform((val) => new Date(val))
      .optional(),

    endDate: z.iso
      .datetime()
      .transform((val) => new Date(val))
      .optional(),

    minAmount: z.coerce
      .number()
      .positive("Minimum amount must be positive")
      .optional(),

    maxAmount: z.coerce
      .number()
      .positive("Maximum amount must be positive")
      .optional(),

    tags: z
      .string()
      .transform((val) => val.split(",").map((t) => t.trim()))
      .optional(),
    currency: z.string().length(3).toUpperCase().optional(),

    search: z.string().max(100).trim().optional(),

    page: z.coerce.number().int().positive().default(1),

    limit: z.coerce
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

export type FilterFinancialRecordQuery = z.infer<
  typeof FilterFinancialRecordSchema
>;

export type CreateFinancialRecordInput = z.infer<
  typeof CreateFinancialRecordSchema
>;
export type UpdateFinancialRecordInput = z.infer<
  typeof UpdateFinancialRecordSchema
>;
export type FilterFinancialRecordInput = z.infer<
  typeof FilterFinancialRecordSchema
>;
