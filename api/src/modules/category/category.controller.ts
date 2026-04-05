import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { parseBody } from "../../utils/helpers";
import { ApiError } from "../../utils/ApiError";
import { categoryService } from "./category.service";
import mongoose from "mongoose";
import {
  CreateCategorySchema,
  FilterCategorySchema,
  UpdateCategorySchema,
} from "./category.validator";

// Helper — extract context for audit logs from every request

function extractAuditCtx(req: Request) {
  return {
    performedBy: req.user._id.toString(),
    ipAddress:
      (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ??
      req.socket.remoteAddress ??
      undefined,
    userAgent: req.headers["user-agent"] ?? undefined,
  };
}

// Controllers

/**
 * POST /categories
 *
 * Creates a new user-owned category.
 * `isSystem` is hardcoded to false in the service — users cannot set it.
 * Roles: analyst, admin
 */
export const createCategory = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const body = parseBody(CreateCategorySchema, req.body);

    const category = await categoryService.create(
      req.user._id.toString(),
      body,
      extractAuditCtx(req)
    );

    res.status(201).json({
      success: true,
      message: "Category created successfully.",
      data: { category },
    });
  }
);

/**
 * GET /categories
 *
 * Returns a paginated list of categories accessible to the user.
 * Includes system categories by default (pass includeSystem=false to hide them).
 * Roles: viewer, analyst, admin
 */
export const getAllCategories = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const query = parseBody(FilterCategorySchema, req.query);

    const result = await categoryService.findAll(
      req.user._id.toString(),
      query
    );

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  }
);

/**
 * GET /categories/:id
 *
 * Returns a single category by ID.
 * Enforces ownership for user categories; system categories visible to all.
 * Roles: viewer, analyst, admin
 */
export const getCategoryById = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;

    if (!mongoose.isValidObjectId(id)) {
      throw new ApiError(400, "Invalid category ID.");
    }

    const category = await categoryService.findById(
      id,
      req.user._id.toString(),
      req.user.role
    );

    res.status(200).json({
      success: true,
      data: { category },
    });
  }
);

/**
 * PATCH /categories/:id
 *
 * Partially updates a category.
 * System categories: only admins may update, and name/type are locked.
 * User categories: owner or admin only.
 * Writes an UPDATE audit log with before/after snapshot.
 * Roles: analyst (own categories), admin (all + system)
 */
export const updateCategory = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (Object.keys(req.body).length === 0) {
      throw new ApiError(400, "Request body cannot be empty.");
    }

    const id = req.params.id as string;

    if (!mongoose.isValidObjectId(id)) {
      throw new ApiError(400, "Invalid category ID.");
    }

    const body = parseBody(UpdateCategorySchema, req.body);

    const category = await categoryService.update(
      id,
      req.user._id.toString(),
      req.user.role,
      body,
      extractAuditCtx(req)
    );

    res.status(200).json({
      success: true,
      message: "Category updated successfully.",
      data: { category },
    });
  }
);

/**
 * DELETE /categories/:id
 *
 * Permanently deletes a user category.
 * Blocked if:
 *   - The category is a system category (no one can delete these)
 *   - Any active financial records reference this category
 * Writes a DELETE audit log with the pre-deletion snapshot.
 * Roles: analyst (own categories), admin (all user categories)
 */
export const deleteCategory = asyncHandler(async (req, res): Promise<void> => {
  const id = req.params.id as string;

  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, "Invalid category ID.");
  }

  await categoryService.remove(
    id,
    req.user._id.toString(),
    req.user.role,
    extractAuditCtx(req)
  );

  res.status(200).json({
    success: true,
    message: "Category deleted successfully.",
  });
});
