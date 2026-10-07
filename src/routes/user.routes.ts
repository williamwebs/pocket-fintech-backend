import { Router } from "express";
import { defaultRateLimiter } from "../middlewares/rateLimit";
import { authenticate } from "../middlewares/authenticate.middleware";
import { deleteMe, deleteUserById, getUserById, me, updateMe } from "../controllers/user.controller";
import { validate } from "../middlewares/validate.middleware";
import { getUserByIdParamsSchema, updateProfileSchema } from "../validators/user.validator";

const userRouter = Router();

userRouter.get("/me", defaultRateLimiter, authenticate, me);
userRouter.get("/:userId", defaultRateLimiter, authenticate, validate(getUserByIdParamsSchema), getUserById);
userRouter.patch("/me", defaultRateLimiter, authenticate, validate(updateProfileSchema), updateMe);
userRouter.delete("/me", defaultRateLimiter, authenticate, deleteMe);
userRouter.delete("/:userId", defaultRateLimiter, authenticate, validate(getUserByIdParamsSchema), deleteUserById);

export default userRouter;
