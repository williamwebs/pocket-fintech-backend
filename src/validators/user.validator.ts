import { z } from "zod";
import { normalizePhoneNumber } from "../utils/phone.js";

export const getUserByIdParamsSchema = z.object({
  params: z.object({
    userId: z.string().min(1, "Invalid user ID"),
  }),
});

export const updateProfileSchema = z.object({
  body: z
    .object({
      name: z.string().min(2, "Name must be at least 2 characters").optional(),
      phone: z
        .string()
        .min(10, "Phone number is too short")
        .transform((val, ctx) => {
          try {
            return normalizePhoneNumber(val);
          } catch {
            ctx.addIssue({
              code: "custom",
              message:
                "Invalid phone number format. Please provide a valid Nigerian phone number.",
            });
            return z.NEVER;
          }
        })
        .optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field must be provided",
    }),
});

export type GetUserByIdParams = z.infer<
  typeof getUserByIdParamsSchema
>["params"];

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>["body"];

