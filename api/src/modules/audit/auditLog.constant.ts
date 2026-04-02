export const AuditAction = {
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
  RESTORE: "restore",
  LOGIN: "login",
  LOGOUT: "logout",
  ROLE_CHANGE: "role_change",
  STATUS_CHANGE: "status_change",
} as const;

export type AuditActionValue = (typeof AuditAction)[keyof typeof AuditAction];

export const AuditResource = {
  USER: "User",
  FINANCIAL_RECORD: "FinancialRecord",
  CATEGORY: "Category",
} as const;

export type AuditResourceValue =
  (typeof AuditResource)[keyof typeof AuditResource];
