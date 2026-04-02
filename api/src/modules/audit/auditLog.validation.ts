import mongoose from "mongoose";
import { z } from "zod";
import { AuditAction, AuditResource } from "./auditLog.constant";

export const CreateAuditLogSchema = z.object({
  performedBy: z
    .string({ error: "performedBy is required" })
    .refine((val) => mongoose.isValidObjectId(val), "Invalid user ID"),

  action: z.enum(
    [
      AuditAction.CREATE,
      AuditAction.UPDATE,
      AuditAction.DELETE,
      AuditAction.RESTORE,
      AuditAction.LOGIN,
      AuditAction.LOGOUT,
      AuditAction.ROLE_CHANGE,
      AuditAction.STATUS_CHANGE,
    ],
    { error: () => ({ message: "Invalid audit action" }) }
  ),

  resource: z.enum(
    [
      AuditResource.USER,
      AuditResource.FINANCIAL_RECORD,
      AuditResource.CATEGORY,
    ],
    { error: () => ({ message: "Invalid resource type" }) }
  ),

  resourceId: z
    .string()
    .refine((val) => mongoose.isValidObjectId(val), "Invalid resource ID")
    .optional(),

  before: z.record(z.string(), z.unknown()).optional(), // State before the mutation
  after: z.record(z.string(), z.unknown()).optional(), // State after the mutation

  ipAddress: z
    .ipv4({ error: "Invalid IP address" })
    .or(z.ipv6({ error: "Invalid IP address" }))
    .optional(),

  userAgent: z.string().max(500).optional(),

  metadata: z.record(z.string(), z.unknown()).optional(), // Any additional context
});

export type CreateAuditLogInput = z.infer<typeof CreateAuditLogSchema>;
