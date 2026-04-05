import mongoose from "mongoose";
import { Category } from "../category/category.model";
import { ApiError } from "../../utils/ApiError";
import {
  CreateFinancialRecordBody,
  FilterFinancialRecordQuery,
  UpdateFinancialRecordBody,
} from "./financial-record.validator";
import {
  FinancialRecord,
  IFinancialRecordDocument,
} from "./financial-record.model";
import logger from "../../utils/logger";
import {
  CategoryBreakdown,
  DashboardSummary,
  MonthlyTrend,
  PaginatedRecords,
  RecentActivity,
} from "./financial-record.types";
import { TransactionType } from "./financial-record.constant";

class FinancialRecordService {
  // Private helpers

  /**
   * Validates that a category exists and the user has access to it.
   * Throws a 404 error if the category is not found.
   * Throws a 403 error if the category is not a system category and the user is not the category creator.
   * @param {string} categoryId - The ID of the category to validate
   * @param {string} userId - The ID of the user to validate against
   * @returns {Promise<void>} - A promise that resolves if the category is valid
   */
  private async validateCategory(
    categoryId: string,
    userId: string
  ): Promise<void> {
    const category = await Category.findById(categoryId);

    if (!category) {
      throw new ApiError(404, "Category not found.");
    }

    if (!category.isSystem && category.createdBy.toString() !== userId) {
      throw new ApiError(403, "You do not have access to this category.");
    }
  }

  /**
   * Builds a mongoose query filter from a FilterFinancialRecordQuery object.
   * @param {string} userId - The ID of the user to filter by
   * @param {FilterFinancialRecordQuery} query - The query object to build the filter from
   * @returns {mongoose.QueryFilter<IFinancialRecordDocument>} - The built filter
   */
  private buildFilter(
    userId: string,
    query: FilterFinancialRecordQuery
  ): mongoose.QueryFilter<IFinancialRecordDocument> {
    const filter: mongoose.QueryFilter<IFinancialRecordDocument> = {
      createdBy: new mongoose.Types.ObjectId(userId),
      isDeleted: false,
    };

    if (query.type) filter.type = query.type;
    if (query.currency) filter.currency = query.currency;

    if (query.category) {
      filter.category = new mongoose.Types.ObjectId(query.category);
    }

    if (query.startDate || query.endDate) {
      filter.date = {};
      if (query.startDate) filter.date.$gte = query.startDate;
      if (query.endDate) filter.date.$lte = query.endDate;
    }

    if (query.minAmount !== undefined || query.maxAmount !== undefined) {
      filter.amount = {};
      if (query.minAmount !== undefined) filter.amount.$gte = query.minAmount;
      if (query.maxAmount !== undefined) filter.amount.$lte = query.maxAmount;
    }

    if (query.tags && query.tags.length > 0) {
      filter.tags = { $in: query.tags };
    }

    if (query.search) {
      filter.notes = { $regex: query.search, $options: "i" };
    }

    return filter;
  }

  /**
   * Creates a new financial record for the given user.
   * Validates the category ownership via `validateCategory`.
   * Populates the category field with the category name, color, icon, and type.
   * Logs a success message with the created record ID and user ID.
   * @param {string} userId - The ID of the user to create the record for
   * @param {CreateFinancialRecordBody} body - The body of the request
   * @returns {Promise<IFinancialRecordDocument>} - A promise that resolves with the created record
   */
  async create(
    userId: string,
    body: CreateFinancialRecordBody
  ): Promise<IFinancialRecordDocument> {
    await this.validateCategory(body.category, userId);

    const record = await FinancialRecord.create({
      ...body,
      category: new mongoose.Types.ObjectId(body.category),
      createdBy: new mongoose.Types.ObjectId(userId),
    });

    logger.info(`Financial record created [${record._id}] by user [${userId}]`);

    return record.populate("category", "name color icon type");
  }

  /**
   * Finds all financial records for the given user that match the given filter.
   * @param {string} userId - The ID of the user to find records for
   * @param {FilterFinancialRecordQuery} query - The filter query
   * @returns {Promise<PaginatedRecords<IFinancialRecordDocument>>} - A promise that resolves with the paginated records
   */
  async findAll(
    userId: string,
    query: FilterFinancialRecordQuery
  ): Promise<PaginatedRecords<IFinancialRecordDocument>> {
    const filter = this.buildFilter(userId, query);

    const sortField =
      query.sortBy === "date"
        ? "date"
        : query.sortBy === "amount"
          ? "amount"
          : "createdAt";

    const sortDirection = query.sortOrder === "asc" ? 1 : -1;
    const skip = (query.page - 1) * query.limit;

    const [records, total] = await Promise.all([
      FinancialRecord.find(filter)
        .populate("category", "name color icon type")
        .sort({ [sortField]: sortDirection })
        .skip(skip)
        .limit(query.limit)
        .lean(),
      FinancialRecord.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / query.limit);

    return {
      data: records as unknown as IFinancialRecordDocument[],
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPrevPage: query.page > 1,
      },
    };
  }

  /**
   * Finds a financial record by ID for the given user.
   * @throws {ApiError} 400 - Invalid record ID.
   * @throws {ApiError} 404 - Financial record not found.
   * @param {string} recordId - The ID of the financial record to find
   * @param {string} userId - The ID of the user to find the record for
   * @returns {Promise<IFinancialRecordDocument>} - A promise that resolves with the found record
   */
  async findById(
    recordId: string,
    userId: string
  ): Promise<IFinancialRecordDocument> {
    if (!mongoose.isValidObjectId(recordId)) {
      throw new ApiError(400, "Invalid record ID.");
    }

    const record = await FinancialRecord.findOne({
      _id: recordId,
      createdBy: userId,
      isDeleted: false,
    }).populate("category", "name color icon type");

    if (!record) {
      throw new ApiError(404, "Financial record not found.");
    }

    return record;
  }

  /**
   * Updates a financial record with the given ID for the given user.
   * Validates category ownership if category changes.
   * Updates all other fields explicitly.
   * @throws {ApiError} 400 - Invalid record ID.
   * @throws {ApiError} 404 - Financial record not found.
   * @param {string} recordId - The ID of the financial record to update
   * @param {string} userId - The ID of the user to update the record for
   * @param {UpdateFinancialRecordBody} body - The updated fields
   * @returns {Promise<IFinancialRecordDocument>} - A promise that resolves with the updated record
   */
  async update(
    recordId: string,
    userId: string,
    body: UpdateFinancialRecordBody
  ): Promise<IFinancialRecordDocument> {
    if (!mongoose.isValidObjectId(recordId)) {
      throw new ApiError(400, "Invalid record ID.");
    }

    const record = await FinancialRecord.findOne({
      _id: recordId,
      createdBy: userId,
      isDeleted: false,
    });

    if (!record) {
      throw new ApiError(404, "Financial record not found.");
    }

    if (body.category && body.category !== record.category.toString()) {
      await this.validateCategory(body.category, userId);
      record.category = new mongoose.Types.ObjectId(body.category);
    }

    // Apply all other updated fields explicitly
    if (body.amount !== undefined) record.amount = body.amount;
    if (body.type !== undefined) record.type = body.type;
    if (body.date !== undefined) record.date = body.date;
    if (body.notes !== undefined) record.notes = body.notes;
    if (body.tags !== undefined) record.tags = body.tags;
    if (body.currency !== undefined) record.currency = body.currency;
    if (body.recurring !== undefined) record.recurring = body.recurring;

    record.updatedBy = new mongoose.Types.ObjectId(userId);

    await record.save();

    logger.info(`Financial record updated [${record._id}] by user [${userId}]`);

    return record.populate("category", "name color icon type");
  }

  /**
   * Soft-deletes a financial record with the given ID for the given user.
   * Enforces ownership — users only see their own records.
   * @throws {ApiError} 400 - Invalid record ID.
   * @throws {ApiError} 404 - Financial record not found.
   * @param {string} recordId - The ID of the financial record to soft-delete
   * @param {string} userId - The ID of the user to soft-delete the record for
   * @returns {Promise<void>} - A promise that resolves when the record is soft-deleted
   */
  async remove(recordId: string, userId: string): Promise<void> {
    if (!mongoose.isValidObjectId(recordId)) {
      throw new ApiError(400, "Invalid record ID.");
    }

    const record = await FinancialRecord.findOne({
      _id: recordId,
      createdBy: userId,
      isDeleted: false,
    });

    if (!record) {
      throw new ApiError(404, "Financial record not found.");
    }

    await record.softDelete(new mongoose.Types.ObjectId(userId));

    logger.info(
      `Financial record soft-deleted [${record._id}] by user [${userId}]`
    );
  }

  /**
   * Restores a soft-deleted financial record with the given ID for the given user.
   * Enforces ownership — users only see their own records.
   * @throws {ApiError} 400 - Invalid record ID.
   * @throws {ApiError} 404 - Deleted record not found.
   * @param {string} recordId - The ID of the financial record to restore
   * @param {string} userId - The ID of the user to restore the record for
   * @returns {Promise<IFinancialRecordDocument>} - A promise that resolves with the restored record
   */
  async restore(
    recordId: string,
    userId: string
  ): Promise<IFinancialRecordDocument> {
    if (!mongoose.isValidObjectId(recordId)) {
      throw new ApiError(400, "Invalid record ID.");
    }

    const record = await FinancialRecord.findOne({
      _id: recordId,
      createdBy: userId,
      isDeleted: true,
    });

    if (!record) {
      throw new ApiError(404, "Deleted record not found.");
    }

    await record.restore();

    logger.info(
      `Financial record restored [${record._id}] by user [${userId}]`
    );

    return record;
  }

  // Dashboard Aggregations

  /**
   * Returns a lightweight dashboard summary for a date range:
   *   - Total income, expense, net balance
   *   - Category breakdowns with percentages
   *   - Last 6 months of trends
   *   - 10 most recent transactions
   *
   * Accepts optional `startDate` and `endDate` query params (ISO 8601).
   * Roles: viewer, analyst, admin
   *
   * @param {string} userId - The ID of the user to get the summary for
   * @param {Date} [startDate] - The start date of the date range (ISO 8601)
   * @param {Date} [endDate] - The end date of the date range (ISO 8601)
   * @returns {Promise<DashboardSummary>} - A promise that resolves with the dashboard summary
   */
  async getDashboardSummary(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<DashboardSummary> {
    const userObjId = new mongoose.Types.ObjectId(userId);

    const dateFilter =
      startDate || endDate
        ? {
            date: {
              ...(startDate && { $gte: startDate }),
              ...(endDate && { $lte: endDate }),
            },
          }
        : {};

    const baseMatch = {
      createdBy: userObjId,
      isDeleted: false,
      ...dateFilter,
    };

    //Totals
    const totalsAgg = await FinancialRecord.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: "$type",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    let totalIncome = 0;
    let totalExpense = 0;
    let transactionCount = 0;

    for (const row of totalsAgg) {
      if (row._id === TransactionType.INCOME) {
        totalIncome = row.total;
        transactionCount += row.count;
      } else if (row._id === TransactionType.EXPENSE) {
        totalExpense = row.total;
        transactionCount += row.count;
      }
    }

    const netBalance = totalIncome - totalExpense;

    // Category breakdown
    const categoryAgg = await FinancialRecord.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: { type: "$type", category: "$category" },
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "categories",
          localField: "_id.category",
          foreignField: "_id",
          as: "categoryInfo",
        },
      },
      { $unwind: { path: "$categoryInfo", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          type: "$_id.type",
          categoryId: "$_id.category",
          categoryName: { $ifNull: ["$categoryInfo.name", "Uncategorized"] },
          total: 1,
          count: 1,
        },
      },
    ]);

    /**
     * Builds a category breakdown from an aggregation result.
     * @param {typeof categoryAgg} rows - The aggregation result rows
     * @param {string} type - The type of transaction to filter by (income/expense)
     * @param {number} typeTotal - The total amount of the given type
     * @returns {CategoryBreakdown[]} - An array of category breakdown objects
     */
    const buildBreakdown = (
      rows: typeof categoryAgg,
      type: string,
      typeTotal: number
    ): CategoryBreakdown[] =>
      rows
        .filter((r) => r.type === type)
        .map((r) => ({
          categoryId: r.categoryId.toString(),
          categoryName: r.categoryName,
          total: r.total,
          count: r.count,
          percentage:
            typeTotal > 0 ? Math.round((r.total / typeTotal) * 10000) / 100 : 0,
        }))
        .sort((a, b) => b.total - a.total);

    const incomeBreakdown = buildBreakdown(
      categoryAgg,
      TransactionType.INCOME,
      totalIncome
    );
    const expenseBreakdown = buildBreakdown(
      categoryAgg,
      TransactionType.EXPENSE,
      totalExpense
    );

    // Monthly trends (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const trendAgg = await FinancialRecord.aggregate([
      {
        $match: {
          ...baseMatch,
          date: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" },
            type: "$type",
          },
          total: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // Merge income/expense rows into one entry per month
    const trendMap = new Map<string, MonthlyTrend>();

    for (const row of trendAgg) {
      const key = `${row._id.year}-${row._id.month}`;

      if (!trendMap.has(key)) {
        trendMap.set(key, {
          year: row._id.year,
          month: row._id.month,
          income: 0,
          expense: 0,
          net: 0,
        });
      }

      const entry = trendMap.get(key)!;

      if (row._id.type === TransactionType.INCOME) {
        entry.income = row.total;
      } else {
        entry.expense = row.total;
      }

      entry.net = entry.income - entry.expense;
    }

    const monthlyTrends: MonthlyTrend[] = Array.from(trendMap.values());

    // Recent activity (last 10 transactions)
    const recentActivity = (await FinancialRecord.find(baseMatch)
      .populate("category", "name color icon")
      .sort({ date: -1 })
      .limit(10)
      .lean()) as unknown as RecentActivity[];

    return {
      totalIncome,
      totalExpense,
      netBalance,
      transactionCount,
      incomeBreakdown,
      expenseBreakdown,
      monthlyTrends,
      recentActivity,
    };
  }

  /**
   * Retrieves a summary of financial records for the given user and date range.
   * @param {string} userId - The ID of the user to retrieve the summary for
   * @param {Date} startDate - The start date of the summary period
   * @param {Date} endDate - The end date of the summary period
   * @returns {Promise<{totalIncome: number, totalExpense: number, netBalance: number}>}
   *   A promise that resolves with an object containing the total income, total expense, and net balance for the given user and date range.
   */
  async getSummary(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalIncome: number;
    totalExpense: number;
    netBalance: number;
  }> {
    const agg = await FinancialRecord.aggregate([
      {
        $match: {
          createdBy: new mongoose.Types.ObjectId(userId),
          isDeleted: false,
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: "$type",
          total: { $sum: "$amount" },
        },
      },
    ]);

    let totalIncome = 0;
    let totalExpense = 0;

    for (const row of agg) {
      if (row._id === TransactionType.INCOME) totalIncome = row.total;
      if (row._id === TransactionType.EXPENSE) totalExpense = row.total;
    }

    return {
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense,
    };
  }
}

export const financialRecordService = new FinancialRecordService();
