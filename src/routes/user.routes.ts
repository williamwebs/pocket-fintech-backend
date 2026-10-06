import { Router } from "express";
import { defaultRateLimiter } from "../middlewares/rateLimit";
import { authenticate } from "../middlewares/authenticate.middleware";
import { getUserById, me } from "../controllers/user.controller";
import { validate } from "../middlewares/validate.middleware";
import { getUserByIdParamsSchema } from "../validators/user.validator";

const userRouter = Router();

userRouter.get("/me", defaultRateLimiter, authenticate, me);
userRouter.get("/:userId", defaultRateLimiter, authenticate, validate(getUserByIdParamsSchema), getUserById);
userRouter.patch("/me", authenticate, defaultRateLimiter, (req, res) => "UPDATE USER PROFILE");
userRouter.delete("/me", authenticate, defaultRateLimiter, (req, res) => "DELETE USER PROFILE");
userRouter.delete("/:userId", authenticate, defaultRateLimiter, (req, res) => "DELETE SPECIFIC USER PROFILE");

export default userRouter;
