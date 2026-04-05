import { ApiError } from "./ApiError";
import { z } from "zod";

export function parseBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);

  if (!result.success) {
    throw new ApiError(
      400,
      result.error.message || "Something went wrong while parsing body"
    );
  }

  return result.data;
}
