export const UserRole = {
  VIEWER: "viewer",
  ANALYST: "analyst",
  ADMIN: "admin",
} as const;

export type UserRoleType = (typeof UserRole)[keyof typeof UserRole];

export const UserStatus = {
  ACTIVE: "active",
  INACTIVE: "inactive",
} as const;

export type UserStatusType = (typeof UserStatus)[keyof typeof UserStatus];
