import { z } from "zod";

export const submitKycSchema = z.object({
  body: z.object({
    firstName: z.string().min(2, "First name must be at least 2 characters"),
    lastName: z.string().min(2, "Last name must be at least 2 characters"),
    middleName: z.string().optional(),
    maidenName: z.string().optional(),
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be in YYYY-MM-DD format"),
    gender: z.enum(["MALE", "FEMALE", "OTHERS"]),
    bvn: z
      .string()
      .regex(/^\d{11}$/, "BVN must be exactly 11 digits"),
    address: z.object({
      addressLine_1: z
        .string()
        .min(3, "Address line 1 must be at least 3 characters"),
      addressLine_2: z.string().optional(),
      city: z.string().min(2, "City must be at least 2 characters"),
      state: z.string().min(2, "State must be at least 2 characters"),
      postalCode: z.string().min(3, "Postal code must be at least 3 characters"),
      country: z
        .string()
        .length(2, "Country must be a 2-letter ISO code (e.g. NG)")
        .default("NG"),
    }),
  }),
});

export type SubmitKycInput = z.infer<typeof submitKycSchema>["body"];
