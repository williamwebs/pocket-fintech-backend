import { Router } from "express";
import { defaultRateLimiter } from "../middlewares/rateLimit";
import { authenticate } from "../middlewares/authenticate.middleware";
import { me } from "../controllers/user.controller";

const userRouter = Router();

userRouter.get("/me", defaultRateLimiter, authenticate, me);
userRouter.patch("/", authenticate, defaultRateLimiter, (req, res) => "UPDATE USER PROFILE");
userRouter.delete("/", authenticate, defaultRateLimiter, (req, res) => "DELETE USER PROFILE");

export default userRouter;
