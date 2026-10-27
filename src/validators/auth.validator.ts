import { z } from "zod";
import { normalizePhoneNumber } from "../utils/phone";

export const signupSchema = z.object({
  body: z.object({
    email: z.email("Invalid email address"),
    fullName: z.string().min(5, "Full name must be at least 5 characters long"),
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
      }),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at east one uppercase letter")
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
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
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

export const logoutSchema = z.object({
  body: z.object({
    allDevices: z.boolean().optional().default(false),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    email: z.email("Invaid email address")
  })
})

export const resetPasswordWithOtpSchema = z.object({
  body: z.object({
    otp: z.string().min(6, "OTP is required"),
    email: z.email("Invalid email address"),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must cntain at east one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(
        /[^A-Za-z0-9]/,
        "Password must contain at least one special character",
      ),
  })
})

export type SignupInput = z.infer<typeof signupSchema>["body"];
export type SigninInput = z.infer<typeof signinSchema>["body"];
export type LogoutInput = z.infer<typeof logoutSchema>["body"];
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>["body"]
export type ResetPasswordWithOtpInput = z.infer<typeof resetPasswordWithOtpSchema>["body"]
