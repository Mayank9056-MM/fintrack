import { z } from "zod";
import { UserRole, UserStatus } from "./user.constants";

export const CreateUserSchema = z.object({
  name: z
    .string({ error: "Name is required" })
    .min(2, "Name must be at least 2 characters")
    .max(80, "Name must be at most 80 characters")
    .trim(),

  email: z.email("Invalid email address").toLowerCase().trim(),

  password: z
    .string({ error: "Password is required" })
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must include uppercase, lowercase, and a number"
    ),

  role: z
    .enum([UserRole.VIEWER, UserRole.ANALYST, UserRole.ADMIN], {
      error: () => ({
        message: `Role must be one of: ${Object.values(UserRole).join(", ")}`,
      }),
    })
    .default(UserRole.VIEWER),

  status: z
    .enum([UserStatus.ACTIVE, UserStatus.INACTIVE])
    .default(UserStatus.ACTIVE),
});

export const UpdateUserSchema = CreateUserSchema.omit({ password: true })
  .partial()
  .strict();

export const UpdatePasswordSchema = z
  .object({
    currentPassword: z.string({
      error: "Current password is required",
    }),
    newPassword: z
      .string({ error: "New password is required" })
      .min(8, "Password must be at least 8 characters")
      .max(128)
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Password must include uppercase, lowercase, and a number"
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
