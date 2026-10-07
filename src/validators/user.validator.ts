import { z } from "zod";

export const getUserByIdParamsSchema = z.object({
  params: z.object({
    userId: z.string("Invalid user ID"),
  }),
});

export const updateProfileSchema = z.object({
  body: z
    .object({
      name: z.string().min(2, "Name must be at least 2 characters").optional(),
      phone: z.string().min(11, "Invalid phone number").optional(),
      homeAddress: z
        .string()
        .min(5, "Home address must be at least 5 characters")
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
