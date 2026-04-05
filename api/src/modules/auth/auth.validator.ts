import { z } from "zod";

const emailField = z.email("Invalid email address").toLowerCase().trim();

const passwordField = z
  .string({ error: "Password is required" })
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters")
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()\-_=+])/,
    "Password must include uppercase, lowercase, a number, and a special character"
  );

// Register

export const RegisterSchema = z
  .object({
    name: z
      .string({ error: "Name is required" })
      .min(2, "Name must be at least 2 characters")
      .max(80, "Name must be at most 80 characters")
      .trim(),

    email: emailField,

    password: passwordField,

    confirmPassword: z.string({
      error: "Please confirm your password",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  // Strip confirmPassword before it reaches the service layer
  .transform(({ confirmPassword: _c, ...rest }) => rest);

export type RegisterBody = z.infer<typeof RegisterSchema>;

// Login

export const LoginSchema = z.object({
  email: emailField,
  password: z
    .string({ error: "Password is required" })
    .min(1, "Password is required"),
});

export type LoginBody = z.infer<typeof LoginSchema>;

// Refresh Token

export const RefreshTokenSchema = z.object({
  refreshToken: z
    .string({ error: "Refresh token is required" })
    .min(1, "Refresh token cannot be empty"),
});

export type RefreshTokenBody = z.infer<typeof RefreshTokenSchema>;

// Change Password

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string({ error: "Current password is required" }).min(1),

    newPassword: passwordField,

    confirmPassword: z.string({
      error: "Please confirm your new password",
    }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from the current password",
    path: ["newPassword"],
  })
  .transform(({ confirmPassword: _c, ...rest }) => rest);

export type ChangePasswordBody = z.infer<typeof ChangePasswordSchema>;

// Forgot Password

export const ForgotPasswordSchema = z.object({
  email: emailField,
});

export type ForgotPasswordBody = z.infer<typeof ForgotPasswordSchema>;

// Reset Password

export const ResetPasswordSchema = z
  .object({
    newPassword: passwordField,
    confirmPassword: z.string({ error: "Please confirm your new password" }),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .transform(({ confirmPassword: _c, ...rest }) => rest);

export type ResetPasswordBody = z.infer<typeof ResetPasswordSchema>;
