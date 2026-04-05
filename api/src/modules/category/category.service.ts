import mongoose from "mongoose";
import { Category, ICategoryDocument } from "./category.model";
import { AuditAction, AuditResource } from "../audit/auditLog.constant";
import AuditLog from "../audit/auditLog.models";
import { ApiError } from "../../utils/ApiError";
import logger from "../../utils/logger";
import { FinancialRecord } from "../financial-record/financial-record.model";
import {
  CreateCategoryInput,
  FilterCategoryInput,
  UpdateCategoryBody,
} from "./category.types";
import { auditLogService } from "../audit/auditLog.service";

// Audit helper — fire-and-forget, never blocks the main flow

interface AuditContext {
  performedBy: string;
  ipAddress?: string;
  userAgent?: string;
}
// Category Service

class CategoryService {
  // Private

  /**
   * Converts a category document to a plain object without virtuals.
   * @param {ICategoryDocument} doc - The category document to convert.
   * @returns {Record<string, unknown>} The plain object without virtuals.
   */
  private toSnapshot(doc: ICategoryDocument): Record<string, unknown> {
    return doc.toObject({ virtuals: false });
  }

  /**
   * Asserts that a category with the given name and type does not already exist
   * for the given user, unless excluded by the excludeId parameter.
   * Throws a 409 error if a category with the same name and type already exists.
   * @throws {ApiError} 409 - A category with the same name and type already exists.
   * @param {string} name - The name of the category to assert uniqueness for.
   * @param {string} type - The type of the category to assert uniqueness for.
   * @param {string} userId - The ID of the user to assert uniqueness for.
   * @param {string} [excludeId] - The ID of the category to exclude from the uniqueness check.
   */
  private async assertUniqueName(
    name: string,
    type: string,
    userId: string,
    excludeId?: string
  ): Promise<void> {
    const filter: mongoose.QueryFilter<ICategoryDocument> = {
      name: { $regex: `^${name.trim()}$`, $options: "i" }, // case-insensitive
      type,
      $or: [
        { isSystem: true },
        { createdBy: new mongoose.Types.ObjectId(userId) },
      ],
    };

    if (excludeId) {
      filter._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
    }

    const existing = await Category.findOne(filter);

    if (existing) {
      throw new ApiError(
        409,
        `A ${type} category named "${name}" already exists.`
      );
    }
  }

  /**
   * Finds a category by ID and validates access:
   *  - System categories are readable by everyone, editable only by admins
   *  - User categories are only accessible by their owner
   *
   * @param forWrite - if true, also blocks non-owners from system categories
   */
  private async findAndAuthorize(
    categoryId: string,
    userId: string,
    role: string,
    forWrite = false
  ): Promise<ICategoryDocument> {
    if (!mongoose.isValidObjectId(categoryId)) {
      throw new ApiError(400, "Invalid category ID.");
    }

    const category = await Category.findById(categoryId);

    if (!category) {
      throw new ApiError(404, "Category not found.");
    }

    if (category.isSystem) {
      // Only admins may mutate system categories
      if (forWrite && role !== "admin") {
        throw new ApiError(403, "Only admins can modify system categories.");
      }
      return category;
    }

    // User-created categories — owner or admin only
    if (category.createdBy.toString() !== userId && role !== "admin") {
      throw new ApiError(403, "You do not have access to this category.");
    }

    return category;
  }

  // Public API

  /**
   * Creates a new category for the given user.
   * Validates that the category name is unique within the same type scope.
   * Populates the category field with the category name, color, icon, and type.
   * Logs a success message with the created record ID and user ID.
   * Fires an audit log for the CREATE action.
   * @param {string} userId - The ID of the user to create the category for
   * @param {CreateCategoryBody} body - The body of the request
   * @param {AuditContext} ctx - The audit context
   * @returns {Promise<ICategoryDocument>} - A promise that resolves with the created category
   */
  async create(
    userId: string,
    body: CreateCategoryInput,
    ctx: AuditContext
  ): Promise<ICategoryDocument> {
    await this.assertUniqueName(body.name, body.type, userId);

    const category = await Category.create({
      ...body,
      isSystem: false, // Users can never set this — hardcoded
      createdBy: new mongoose.Types.ObjectId(userId),
    });

    await auditLogService.log({
      action: AuditAction.CREATE,
      resource: AuditResource.CATEGORY,
      resourceId: category._id.toString(),
      performedBy: ctx.performedBy,
      after: this.toSnapshot(category),
    });

    logger.info(`Category created [${category._id}] by user [${userId}]`);

    return category;
  }

  /**
   * Finds all categories for the given user that match the given filter.
   * @param {string} userId - The ID of the user to find categories for
   * @param {FilterCategoryQuery} query - The filter query
   * @returns {Promise<{data: ICategoryDocument[]; pagination: {total: number; page: number; limit: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean;}>}
   * A promise that resolves with the paginated records
   */
  async findAll(
    userId: string,
    query: FilterCategoryInput
  ): Promise<{
    data: ICategoryDocument[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPrevPage: boolean;
    };
  }> {
    const filter: mongoose.QueryFilter<ICategoryDocument> = {
      $or: [
        { createdBy: new mongoose.Types.ObjectId(userId) },
        ...(query.includeSystem ? [{ isSystem: true }] : []),
      ],
    };

    if (query.type) filter.type = query.type;

    if (query.search) {
      filter.name = { $regex: query.search.trim(), $options: "i" };
    }

    const skip = (query.page - 1) * query.limit;

    const [data, total] = await Promise.all([
      Category.find(filter)
        .sort({ isSystem: -1, name: 1 })
        .skip(skip)
        .limit(query.limit)
        .lean(),
      Category.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / query.limit);

    return {
      data: data as unknown as ICategoryDocument[],
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
   * Finds a category by its ID and checks if the user has access to it.
   * - If the category is not found, throws a 404 error.
   * - If the category is not a system category and the user is not the category creator,
   *   throws a 403 error.
   * @param {string} categoryId - The ID of the category to find
   * @param {string} userId - The ID of the user to find the category for
   * @param {string} role - The role of the user to find the category for
   * @returns {Promise<ICategoryDocument>} - A promise that resolves with the found category document
   */
  async findById(
    categoryId: string,
    userId: string,
    role: string
  ): Promise<ICategoryDocument> {
    return this.findAndAuthorize(categoryId, userId, role, false);
  }

  /**
   * Updates a category by its ID.
   * - System categories cannot be renamed or retyped.
   * - Name uniqueness is enforced only if name or type changes.
   * - Writes an UPDATE audit log.
   * @param {string} categoryId - The ID of the category to update
   * @param {string} userId - The ID of the user to update the category for
   * @param {string} role - The role of the user to update the category for
   * @param {UpdateCategoryBody} body - The fields to update
   * @param {AuditContext} ctx - The audit context to write the audit log with
   * @returns {Promise<ICategoryDocument>} - A promise that resolves with the updated category document
   */
  async update(
    categoryId: string,
    userId: string,
    role: string,
    body: UpdateCategoryBody,
    ctx: AuditContext
  ): Promise<ICategoryDocument> {
    const category = await this.findAndAuthorize(
      categoryId,
      userId,
      role,
      true // write
    );

    // Prevent renaming or retyping system categories — they're fixed by design
    if (category.isSystem) {
      if (body.name !== undefined || body.type !== undefined) {
        throw new ApiError(
          400,
          "System category name and type cannot be changed."
        );
      }
    }

    const before = this.toSnapshot(category);

    // Name uniqueness check only if name or type changes
    const newName = body.name ?? category.name;
    const newType = body.type ?? category.type;
    const nameOrTypeChanged =
      body.name !== undefined || body.type !== undefined;

    if (nameOrTypeChanged) {
      await this.assertUniqueName(newName, newType, userId, categoryId);
    }

    // Apply fields
    if (body.name !== undefined) category.name = body.name;
    if (body.type !== undefined) category.type = body.type;
    if (body.description !== undefined) category.description = body.description;
    if (body.color !== undefined) category.color = body.color;
    if (body.icon !== undefined) category.icon = body.icon;

    await category.save();

    const after = this.toSnapshot(category);

    await auditLogService.log({
      action: AuditAction.CREATE,
      resource: AuditResource.CATEGORY,
      resourceId: category._id.toString(),
      performedBy: ctx.performedBy,
      after: this.toSnapshot(category),
    });

    logger.info(`Category updated [${category._id}] by user [${userId}]`);

    return category;
  }

  /**
   * Removes a category by ID for the given user.
   * Enforces ownership — users only see their own categories.
   * Checks if the category is a system category and throws a 403 error if so.
   * Checks if the category is used by any financial records and throws a 409 error if so.
   * Logs a success message with the deleted category ID and user ID.
   * @param {string} categoryId - The ID of the category to delete
   * @param {string} userId - The ID of the user to delete the category for
   * @param {string} role - The role of the user to delete the category for
   * @param {AuditContext} ctx - The audit context to log the action in
   * @returns {Promise<void>} - A promise that resolves when the category is deleted
   */
  async remove(
    categoryId: string,
    userId: string,
    role: string,
    ctx: AuditContext
  ): Promise<void> {
    const category = await this.findAndAuthorize(
      categoryId,
      userId,
      role,
      true // write
    );

    if (category.isSystem) {
      throw new ApiError(403, "System categories cannot be deleted.");
    }

    const usageCount = await FinancialRecord.countDocuments({
      category: category._id,
      isDeleted: false,
    });

    if (usageCount > 0) {
      throw new ApiError(
        409,
        `Cannot delete: ${usageCount} financial record${usageCount > 1 ? "s" : ""} still use this category.`
      );
    }

    const before = this.toSnapshot(category);

    await Category.findByIdAndDelete(categoryId);

    await auditLogService.log({
      action: AuditAction.CREATE,
      resource: AuditResource.CATEGORY,
      resourceId: category._id.toString(),
      performedBy: ctx.performedBy,
      after: this.toSnapshot(category),
    });

    logger.info(`Category deleted [${categoryId}] by user [${userId}]`);
  }
}

export const categoryService = new CategoryService();
