export const AuditAction = {
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
  RESTORE: "restore",
  LOGIN: "login",
  LOGOUT: "logout",
  ROLE_CHANGE: "role_change",
  STATUS_CHANGE: "status_change",
  PASSWORD_CHANGE: "password_change",
  AVATAR_CHANGE: "avatar_change",
  EMAIL_CHANGE: "email_change",
  REGISTER: "register",
  FORGOT_PASSWORD: "forgot_password",
  RESET_PASSWORD: "reset_password",
  ISSUE_REFRESH_TOKEN: "issue_refresh_token",
  REVOKE_REFRESH_TOKEN: "revoke_refresh_token",
  ISSUE_ACCESS_TOKEN: "issue_access_token",
  LOGOUT_ALL: "logoutall",
  REVOKE_ACCESS_TOKEN: "revoke_access_token",
  REFRESH_ACCESS_TOKEN: "refresh_access_token",
  REFRESH_REFRESH_TOKEN: "refresh_refresh_token",
  EMAIL_VERIFICATION: "email_verification",
} as const;

export type AuditActionValue = (typeof AuditAction)[keyof typeof AuditAction];

export const AuditResource = {
  USER: "User",
  FINANCIAL_RECORD: "FinancialRecord",
  CATEGORY: "Category",
} as const;

export type AuditResourceValue =
  (typeof AuditResource)[keyof typeof AuditResource];
