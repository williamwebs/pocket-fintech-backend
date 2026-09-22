import { z } from "zod";

export const signupSchema = z.object({
  body: z.object({
    email: z.email("Invalid email address"),
    fullName: z.string().min(5, "Full name must be at least 5 characters long"),
    role: z.enum(["USER", "ADMIN", "SUPERADMIN"], "Invalid role"),
    phone: z.string().min(11, "Invalid phone number"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must cntain at east one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(
        /[^A-Za-z0-9]/,
        "Password must contain at least one special character",
      ),
  }),
});

export const signinSchema = z.object({
  body: z.object({
    email: z.email("Invalid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must cntain at east one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(
        /[^A-Za-z0-9]/,
        "Password must contain at least one special character",
      ),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, "Refresh token is required"),
  }),
});

export type SignupInput = z.infer<typeof signupSchema>["body"];
export type SigninInput = z.infer<typeof signinSchema>["body"];
