import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { defaultRateLimiter } from "../middlewares/rateLimit.js";
import {
  createPocketSchema,
  updatePocketSchema,
  updateSplitsSchema,
} from "../validators/pocket.validator.js";
import {
  createPocket,
  getMyPockets,
  updatePocket,
  updateSplits,
} from "../controllers/pocket.controller.js";

const pocketRouter = Router();

// All pocket endpoints require authentication
pocketRouter.use(defaultRateLimiter);
pocketRouter.use(authenticate);

pocketRouter.get("/", getMyPockets);
pocketRouter.post("/", validate(createPocketSchema), createPocket);
pocketRouter.put("/splits", validate(updateSplitsSchema), updateSplits);
pocketRouter.patch("/:pocketId", validate(updatePocketSchema), updatePocket);

export default pocketRouter;
