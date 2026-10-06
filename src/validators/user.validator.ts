import { z } from "zod"

export const getUserByIdParamsSchema = z.object({
  params: z.object({
    userId: z.string("Invalid user ID"),
  }),
});

export type GetUserByIdParams = z.infer<typeof getUserByIdParamsSchema>["params"];