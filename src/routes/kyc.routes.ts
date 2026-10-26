import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { defaultRateLimiter } from "../middlewares/rateLimit.js";
import { submitKycSchema } from "../validators/kyc.validator.js";
import { submitKyc } from "../controllers/kyc.controller.js";

const kycRouter = Router();

kycRouter.post(
  "/",
  defaultRateLimiter,
  authenticate,
  validate(submitKycSchema),
  submitKyc,
);

export default kycRouter;
