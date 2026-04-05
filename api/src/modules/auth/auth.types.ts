import { Request } from "express";
import { IUserDocument } from "../user/user.model";

// Token Payloads

export interface AccessTokenPayload {
  sub: string; // User ID
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  sub: string; // User ID
  jti: string; // Unique token ID — used for revocation lookup
  iat?: number;
  exp?: number;
}

// Service Input Types

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  avatarLocalPath: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface LoginInput {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface RefreshTokenInput {
  refreshToken: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface ChangePasswordInput {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  token: string;
  newPassword: string;
}

export interface IssueRefreshTokenInput {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}

// Service Response Types

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse extends AuthTokens {
  user: SafeUser;
}

/**
 * A user object safe to return in API responses.
 * Password is always stripped — never exposed.
 */
export type SafeUser = Omit<
  IUserDocument,
  | "password"
  | "resetPasswordToken"
  | "resetPasswordExpire"
  | "__v"
  | "comparePassword"
  | "isActive"
  | "hasRole"
>;

// Express Request Extensions

/**
 * Extend Express Request to carry the authenticated user after
 * the `authenticate` middleware runs.
 */
export interface AuthRequest extends Request {
  user: IUserDocument;
}

// Cookie Config

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "strict" | "lax" | "none";
  path: string;
}
