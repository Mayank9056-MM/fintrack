import logger from "../../utils/logger";
import AuditLog from "./auditLog.models";
import { CreateAuditLogInput } from "./auditLog.validation";

class AuditLogService {
  async log({
    action,
    resource,
    resourceId,
    performedBy,
    before,
    after,
    ipAddress,
    userAgent,
  }: CreateAuditLogInput) {
    try {
      await AuditLog.logAction({
        action,
        resource,
        resourceId,
        performedBy,
        before,
        after,
        ipAddress,
        userAgent,
      });
    } catch (err) {
      logger.error("Audit log failed", err);
    }
  }
}

export const auditLogService = new AuditLogService();
