export const CategoryType = {
  INCOME: "income",
  EXPENSE: "expense",
  BOTH: "both", // A category that applies to either direction
} as const;

export type CategoryTypeValue =
  (typeof CategoryType)[keyof typeof CategoryType];
