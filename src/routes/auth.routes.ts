import { Router } from "express";
import { loginRateLimiter, resetPasswordRateLimiter, signupRateLimiter } from "../middlewares/rateLimit";
import {
  logout,
  refresh,
  requestPasswordReset,
  signin,
  signup,
} from "../controllers/auth.controller";
import { validate } from "../middlewares/validate.middleware";
import {
  logoutSchema,
  refreshTokenSchema,
  resetPasswordSchema,
  signinSchema,
  signupSchema,
} from "../validators/auth.validator";

const authRouter = Router();

authRouter.post("/signup", signupRateLimiter, validate(signupSchema), signup);
authRouter.post("/signin", loginRateLimiter, validate(signinSchema), signin);
authRouter.post("/logout", validate(logoutSchema), logout);
authRouter.post("/refresh", refresh);
authRouter.post("/request-otp", resetPasswordRateLimiter, validate(resetPasswordSchema), requestPasswordReset)

export default authRouter;
