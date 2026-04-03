import mongoose, { Document, Model, Schema } from "mongoose";
import { QueryFilter } from "mongoose";
import {
  RecurringInterval,
  RecurringIntervalValue,
  TransactionType,
  TransactionTypeValue,
} from "./financial-record.constant";

// Types

type safeFinancial = {
  __v?: number;
};

// Mongoose Interface

export interface IFinancialRecord {
  amount: number;
  type: TransactionTypeValue;
  category: mongoose.Types.ObjectId;
  date: Date;
  notes?: string;
  tags: string[];
  currency: string;
  recurring: RecurringIntervalValue;

  // Ownership
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;

  // Soft delete
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: mongoose.Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

export interface IFinancialRecordMethods {
  softDelete(userId: mongoose.Types.ObjectId): Promise<void>;
  restore(): Promise<void>;
}

export interface IFinancialRecordDocument
  extends IFinancialRecord, IFinancialRecordMethods, Document {}

export interface IFinancialRecordModel extends Model<IFinancialRecordDocument> {
  findActive(
    filter?: mongoose.QueryFilter<IFinancialRecordDocument>
  ): mongoose.Query<IFinancialRecordDocument[], IFinancialRecordDocument>;
}

// Schema

const financialRecordSchema = new Schema<
  IFinancialRecordDocument,
  IFinancialRecordModel,
  IFinancialRecordMethods
>(
  {
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0.01, "Amount must be greater than 0"],
    },

    type: {
      type: String,
      enum: Object.values(TransactionType),
      required: [true, "Transaction type is required"],
    },

    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
    },

    date: {
      type: Date,
      required: [true, "Date is required"],
      index: true,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: [500, "Notes must be at most 500 characters"],
      default: null,
    },

    tags: {
      type: [String],
      default: [],
      validate: {
        validator: (tags: string[]) => tags.length <= 10,
        message: "You can have at most 10 tags",
      },
    },

    currency: {
      type: String,
      uppercase: true,
      trim: true,
      default: "USD",
      minlength: [3, "Currency must be a 3-letter ISO code"],
      maxlength: [3, "Currency must be a 3-letter ISO code"],
    },

    recurring: {
      type: String,
      enum: Object.values(RecurringInterval),
      default: RecurringInterval.NONE,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "CreatedBy is required"],
    },

    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // ── Soft Delete Fields ──
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: safeFinancial) {
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// Indexes — Designed for dashboard query patterns

// Core lookup: active records by user sorted by date
financialRecordSchema.index({ createdBy: 1, isDeleted: 1, date: -1 });

// Filter by type (income/expense) + user
financialRecordSchema.index({ createdBy: 1, type: 1, isDeleted: 1 });

// Filter by category + user
financialRecordSchema.index({ createdBy: 1, category: 1, isDeleted: 1 });

// Date range queries for dashboard summaries
financialRecordSchema.index({ date: -1, isDeleted: 1 });

// Tag-based filtering
financialRecordSchema.index({ tags: 1 });

// Currency-based filtering
financialRecordSchema.index({ currency: 1 });

// Instance Methods

financialRecordSchema.methods.softDelete = async function (
  userId: mongoose.Types.ObjectId
): Promise<void> {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  await this.save();
};

financialRecordSchema.methods.restore = async function (): Promise<void> {
  this.isDeleted = false;
  this.deletedAt = undefined;
  this.deletedBy = undefined;
  await this.save();
};

// Static Methods

financialRecordSchema.statics.findActive = function (
  filter: mongoose.QueryFilter<IFinancialRecordDocument> = {}
) {
  return this.find({ ...filter, isDeleted: false });
};

// Virtuals

// Signed amount: positive for income, negative for expense
financialRecordSchema.virtual("signedAmount").get(function () {
  return this.type === TransactionType.INCOME ? this.amount : -this.amount;
});

// Export

export const FinancialRecord = mongoose.model<
  IFinancialRecordDocument,
  IFinancialRecordModel
>("FinancialRecord", financialRecordSchema);
