export interface PaginatedRecords<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// Dashboard summary types

export interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  total: number;
  count: number;
  percentage: number;
}

export interface MonthlyTrend {
  year: number;
  month: number; // 1–12
  income: number;
  expense: number;
  net: number;
}

export interface DashboardSummary {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  transactionCount: number;
  incomeBreakdown: CategoryBreakdown[];
  expenseBreakdown: CategoryBreakdown[];
  monthlyTrends: MonthlyTrend[];
  recentActivity: RecentActivity[];
}

export interface RecentActivity {
  _id: string;
  amount: number;
  type: string;
  category: { _id: string; name: string; color?: string };
  date: Date;
  notes?: string;
  currency: string;
}
