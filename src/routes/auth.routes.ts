import { Router } from "express";
import { loginRateLimiter, signupRateLimiter } from "../middlewares/rateLimit";
import {
  logout,
  refresh,
  signin,
  signup,
} from "../controllers/auth.controller";
import { validate } from "../middlewares/validate.middleware";
import {
  logoutSchema,
  refreshTokenSchema,
  signinSchema,
  signupSchema,
} from "../validators/auth.validator";

const authRouter = Router();

authRouter.post("/signup", signupRateLimiter, validate(signupSchema), signup);
authRouter.post("/signin", loginRateLimiter, validate(signinSchema), signin);
authRouter.post("/logout", validate(logoutSchema), logout);
authRouter.post("/refresh", refresh);

export default authRouter;
