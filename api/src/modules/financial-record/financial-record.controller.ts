// CRUD Controllers

import mongoose from "mongoose";
import { asyncHandler } from "../../utils/asyncHandler";
import { parseBody } from "../../utils/helpers";
import { financialRecordService } from "./financial-record.service";
import {
  CreateFinancialRecordSchema,
  FilterFinancialRecordSchema,
  UpdateFinancialRecordSchema,
} from "./financial-record.validator";
import { ApiError } from "../../utils/ApiError";

/**
 * POST /financial-records
 *
 * Creates a new financial record for the authenticated user.
 * Validates category ownership and record fields via Zod.
 * Roles: analyst, admin
 */
export const createRecord = asyncHandler(async (req, res): Promise<void> => {
  const body = parseBody(CreateFinancialRecordSchema, req.body);

  const record = await financialRecordService.create(
    req.user._id.toString(),
    body
  );

  res.status(201).json({
    success: true,
    message: "Financial record created successfully.",
    data: { record },
  });
});

/**
 * GET /financial-records
 *
 * Returns a paginated, filterable list of the authenticated user's records.
 * Query params are validated and coerced through FilterFinancialRecordSchema.
 * Roles: viewer, analyst, admin
 */
export const getAllRecords = asyncHandler(async (req, res): Promise<void> => {
  const query = parseBody(FilterFinancialRecordSchema, req.query);

  const result = await financialRecordService.findAll(
    req.user._id.toString(),
    query
  );

  res.status(200).json({
    success: true,
    data: result.data,
    pagination: result.pagination,
  });
});

/**
 * GET /financial-records/:id
 *
 * Returns a single financial record by ID.
 * Enforces ownership — users only see their own records.
 * Roles: viewer, analyst, admin
 */
export const getRecordById = asyncHandler(async (req, res): Promise<void> => {
  const id = req.params.id as string;

  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, "Invalid record ID.");
  }

  const record = await financialRecordService.findById(
    id,
    req.user._id.toString()
  );

  res.status(200).json({
    success: true,
    data: { record },
  });
});

/**
 * PATCH /financial-records/:id
 *
 * Partially updates a financial record.
 * Re-validates category ownership if category changes.
 * Roles: analyst, admin
 */
export const updateRecord = asyncHandler(async (req, res): Promise<void> => {
  if (Object.keys(req.body).length === 0) {
    throw new ApiError(400, "Request body cannot be empty.");
  }

  const id = req.params.id as string;

  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, "Invalid record ID.");
  }

  const body = parseBody(UpdateFinancialRecordSchema, req.body);

  const record = await financialRecordService.update(
    id,
    req.user._id.toString(),
    body
  );

  res.status(200).json({
    success: true,
    message: "Financial record updated successfully.",
    data: { record },
  });
});

/**
 * DELETE /financial-records/:id
 *
 * Soft-deletes a financial record (sets isDeleted: true).
 * Hard deletion is not exposed — preserves audit history.
 * Roles: analyst, admin
 */
export const deleteRecord = asyncHandler(async (req, res): Promise<void> => {
  const id = req.params.id as string;

  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, "Invalid record ID.");
  }

  await financialRecordService.remove(id, req.user._id.toString());

  res.status(200).json({
    success: true,
    message: "Financial record deleted successfully.",
  });
});

/**
 * PATCH /financial-records/:id/restore
 *
 * Restores a soft-deleted record.
 * Roles: admin only
 */
export const restoreRecord = asyncHandler(async (req, res): Promise<void> => {
  const id = req.params.id as string;

  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, "Invalid record ID.");
  }

  const record = await financialRecordService.restore(
    id,
    req.user._id.toString()
  );

  res.status(200).json({
    success: true,
    message: "Financial record restored successfully.",
    data: { record },
  });
});

// Dashboard Controllers

/**
 * GET /financial-records/dashboard
 *
 * Returns the full dashboard summary:
 *   - Total income, expense, net balance
 *   - Category breakdowns with percentages
 *   - Last 6 months of trends
 *   - 10 most recent transactions
 *
 * Accepts optional `startDate` and `endDate` query params (ISO 8601).
 * Roles: viewer, analyst, admin
 */
export const getDashboard = asyncHandler(async (req, res): Promise<void> => {
  const { startDate, endDate } = req.query;

  const start = startDate ? new Date(startDate as string) : undefined;

  const end = endDate ? new Date(endDate as string) : undefined;

  if (start && isNaN(start.getTime())) {
    throw new ApiError(400, "startDate must be a valid date.");
  }

  if (end && isNaN(end.getTime())) {
    throw new ApiError(400, "endDate must be a valid date.");
  }

  if (start && end && start > end) {
    throw new ApiError(400, "startDate must be before endDate.");
  }

  const summary = await financialRecordService.getDashboardSummary(
    req.user._id.toString(),
    start,
    end
  );

  res.status(200).json({
    success: true,
    data: summary,
  });
});

/**
 * GET /financial-records/summary
 *
 * Returns a lightweight income/expense/net summary for a date range.
 * Requires both `startDate` and `endDate` as ISO 8601 query params.
 * Used for header summary cards on the dashboard.
 * Roles: viewer, analyst, admin
 */
export const getSummary = asyncHandler(async (req, res): Promise<void> => {
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    throw new ApiError(
      400,
      "Both startDate and endDate query parameters are required."
    );
  }

  const start = new Date(startDate as string);
  const end = new Date(endDate as string);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new ApiError(400, "startDate and endDate must be valid dates.");
  }

  if (start > end) {
    throw new ApiError(400, "startDate must be before endDate.");
  }

  const summary = await financialRecordService.getSummary(
    req.user._id.toString(),
    start,
    end
  );

  res.status(200).json({
    success: true,
    data: summary,
  });
});
