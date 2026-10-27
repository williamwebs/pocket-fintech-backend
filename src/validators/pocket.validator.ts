import { z } from "zod";

export const PocketTypeEnum = z.enum(["SAVINGS", "INVESTMENT", "EMERGENCY"]);

export const createPocketSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(2, "Pocket name must be at least 2 characters")
      .max(50, "Pocket name must not exceed 50 characters")
      .refine(
        (val) => val.trim().toLowerCase() !== "spending",
        "The 'Spending' pocket is automatically created and reserved",
      ),
    type: PocketTypeEnum,
    splitPercent: z
      .number()
      .int("Split percentage must be an integer")
      .min(0, "Split percentage cannot be negative")
      .max(100, "Split percentage cannot exceed 100")
      .optional()
      .default(0),
  }),
});

export const updatePocketSchema = z.object({
  params: z.object({
    pocketId: z.string().uuid("Invalid pocket ID format"),
  }),
  body: z.object({
    name: z
      .string()
      .min(2, "Pocket name must be at least 2 characters")
      .max(50, "Pocket name must not exceed 50 characters")
      .refine(
        (val) => val.trim().toLowerCase() !== "spending",
        "Cannot rename to 'Spending'",
      )
      .optional(),
    splitPercent: z
      .number()
      .int("Split percentage must be an integer")
      .min(0, "Split percentage cannot be negative")
      .max(100, "Split percentage cannot exceed 100")
      .optional(),
  }),
});

export const updateSplitsSchema = z.object({
  body: z.object({
    splits: z
      .array(
        z.object({
          pocketId: z.string().uuid("Invalid pocket ID"),
          splitPercent: z
            .number()
            .int()
            .min(0, "Split percent must be at least 0")
            .max(100, "Split percent cannot exceed 100"),
        }),
      )
      .min(1, "At least one pocket split must be provided"),
  }),
});

export const pocketIdParamSchema = z.object({
  params: z.object({
    pocketId: z.string().uuid("Invalid pocket ID"),
  }),
});

export type CreatePocketInput = z.infer<typeof createPocketSchema>["body"];
export type UpdatePocketInput = z.infer<typeof updatePocketSchema>["body"];
export type UpdateSplitsInput = z.infer<typeof updateSplitsSchema>["body"];
