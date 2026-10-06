import { Router } from "express";
import { loginRateLimiter, resetPasswordRateLimiter, signupRateLimiter } from "../middlewares/rateLimit";
import {
  logout,
  refresh,
  requestPasswordReset,
  resetPasswordWithOtp,
  signin,
  signup,
} from "../controllers/auth.controller";
import { validate } from "../middlewares/validate.middleware";
import {
  logoutSchema,
  resetPasswordSchema,
  resetPasswordWithOtpSchema,
  signinSchema,
  signupSchema,
} from "../validators/auth.validator";

const authRouter = Router();

authRouter.post("/signup", signupRateLimiter, validate(signupSchema), signup);
authRouter.post("/signin", loginRateLimiter, validate(signinSchema), signin);
authRouter.post("/logout", validate(logoutSchema), logout);
authRouter.post("/refresh", refresh);
authRouter.post("/request-otp", resetPasswordRateLimiter, validate(resetPasswordSchema), requestPasswordReset)
authRouter.post("/reset-password", resetPasswordRateLimiter, validate(resetPasswordWithOtpSchema), resetPasswordWithOtp)

export default authRouter;
