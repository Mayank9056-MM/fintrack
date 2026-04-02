import mongoose from "mongoose";
import { z } from "zod";

export const CreateRefreshTokenSchema = z.object({
  user: z
    .string({ error: "User ID is required" })
    .refine((val) => mongoose.isValidObjectId(val), "Invalid user ID"),

  token: z.string({ error: "Token is required" }).min(10, "Token is too short"),

  expiresAt: z.date({ error: "Expiry date is required" }),

  ipAddress: z.string().optional(),
  userAgent: z.string().max(500).optional(),
});

export type CreateRefreshTokenInput = z.infer<typeof CreateRefreshTokenSchema>;
