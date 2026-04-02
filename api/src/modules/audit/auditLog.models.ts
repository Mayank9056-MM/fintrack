import mongoose, { Document, Model, Schema } from "mongoose";
import {
  AuditAction,
  AuditActionValue,
  AuditResource,
  AuditResourceValue,
} from "./auditLog.constant";
import { CreateAuditLogInput } from "./auditLog.validation";

type safeAuditLog = {
  __v?: number;
};

// Mongoose Interface

export interface IAuditLog {
  performedBy: mongoose.Types.ObjectId;
  action: AuditActionValue;
  resource: AuditResourceValue;
  resourceId?: mongoose.Types.ObjectId;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface IAuditLogDocument extends IAuditLog, Document {}
export interface IAuditLogModel extends Model<IAuditLogDocument> {
  logAction(data: CreateAuditLogInput): Promise<IAuditLogDocument>;
}

// Schema Definition

const auditLogSchema = new Schema<IAuditLogDocument, IAuditLogModel>(
  {
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "performedBy is required"],
    },

    action: {
      type: String,
      enum: Object.values(AuditAction),
      required: [true, "Action is required"],
    },

    resource: {
      type: String,
      enum: Object.values(AuditResource),
      required: [true, "Resource type is required"],
    },

    resourceId: {
      type: Schema.Types.ObjectId,
      default: null,
    },

    // Snapshot of the document before mutation
    before: {
      type: Schema.Types.Mixed,
      default: null,
    },

    // Snapshot of the document after mutation
    after: {
      type: Schema.Types.Mixed,
      default: null,
    },

    ipAddress: {
      type: String,
      default: null,
    },

    userAgent: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  {
    // Audit logs are append-only — no updatedAt needed
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      virtuals: true,
      transform(_doc, ret: safeAuditLog) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes

auditLogSchema.index({ performedBy: 1, createdAt: -1 });
auditLogSchema.index({ resource: 1, resourceId: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ createdAt: -1 });

// Static Methods

/**
 * Creates a new audit log entry based on the provided data
 * @param {CreateAuditLogInput} data - The data to be used for creating the audit log entry
 * @returns {Promise<IAuditLogDocument>} - The created audit log entry document
 */
auditLogSchema.statics.logAction = function (
  data: CreateAuditLogInput
): Promise<IAuditLogDocument> {
  return this.create(data);
};

// Export

const AuditLog = mongoose.model<IAuditLogDocument, IAuditLogModel>(
  "AuditLog",
  auditLogSchema
);

export default AuditLog;
