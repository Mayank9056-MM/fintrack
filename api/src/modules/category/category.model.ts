import mongoose, { Document, Model, Schema } from "mongoose";
import { CategoryType, CategoryTypeValue } from "./category.constants";

// Types

type safeCategory = {
  __v?: number;
};

// Mongoose Interface

export interface ICategory {
  name: string;
  type: CategoryTypeValue;
  description?: string;
  color?: string;
  icon?: string;
  isSystem: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICategoryDocument extends ICategory, Document {}
export interface ICategoryModel extends Model<ICategoryDocument> {}

// Schema

const categorySchema = new Schema<ICategoryDocument>(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [60, "Name must be at most 60 characters"],
    },

    type: {
      type: String,
      enum: Object.values(CategoryType),
      required: [true, "Category type is required"],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [200, "Description must be at most 200 characters"],
      default: null,
    },

    color: {
      type: String,
      match: [/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, "Invalid hex color code"],
      default: null,
    },

    icon: {
      type: String,
      trim: true,
      maxlength: [50, "Icon name must be at most 50 characters"],
      default: null,
    },

    isSystem: {
      type: Boolean,
      default: false,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Created by user is required"],
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: safeCategory) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes

// Ensure category names are unique per type
categorySchema.index({ name: 1, type: 1, createdBy: 1 }, { unique: true });
categorySchema.index({ type: 1 });
categorySchema.index({ createdBy: 1 });
categorySchema.index({ isSystem: 1 });

// Guard: Prevent deletion of system categories (enforced at service layer)
// This virtual is a helper for service-level checks

categorySchema.virtual("isDeletable").get(function () {
  return !this.isSystem;
});

// Export

export const Category = mongoose.model<ICategoryDocument, ICategoryModel>(
  "Category",
  categorySchema
);
