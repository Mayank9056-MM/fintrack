export const TransactionType = {
  INCOME: "income",
  EXPENSE: "expense",
} as const;

export type TransactionTypeValue =
  (typeof TransactionType)[keyof typeof TransactionType];

export const RecurringInterval = {
  NONE: "none",
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  YEARLY: "yearly",
} as const;

export type RecurringIntervalValue =
  (typeof RecurringInterval)[keyof typeof RecurringInterval];
