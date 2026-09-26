import { Router } from "express";
import { loginRateLimiter, signupRateLimiter } from "../middlewares/rateLimit";
import { refresh, signin, signup } from "../controllers/auth.controller";
import { validate } from "../middlewares/validate.middleware";
import { signinSchema, signupSchema } from "../validators/auth.validator";

const authRouter = Router();

authRouter.post("/signup", signupRateLimiter, validate(signupSchema), signup);
authRouter.post("/signin", loginRateLimiter, validate(signinSchema), signin)
authRouter.post("/refresh", refresh)

export default authRouter;