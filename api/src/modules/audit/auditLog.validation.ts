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
      AuditAction.LOGOUT_ALL,
      AuditAction.STATUS_CHANGE,
      AuditAction.PASSWORD_CHANGE,
      AuditAction.AVATAR_CHANGE,
      AuditAction.EMAIL_CHANGE,
      AuditAction.REGISTER,
      AuditAction.FORGOT_PASSWORD,
      AuditAction.RESET_PASSWORD,
      AuditAction.ISSUE_REFRESH_TOKEN,
      AuditAction.REVOKE_REFRESH_TOKEN,
      AuditAction.ISSUE_ACCESS_TOKEN,
      AuditAction.REVOKE_ACCESS_TOKEN,
      AuditAction.REFRESH_ACCESS_TOKEN,
      AuditAction.REFRESH_REFRESH_TOKEN,
      AuditAction.EMAIL_VERIFICATION,
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
