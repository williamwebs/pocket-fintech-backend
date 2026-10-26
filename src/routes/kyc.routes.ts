import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import { defaultRateLimiter } from "../middlewares/rateLimit.js";
import { submitKycSchema } from "../validators/kyc.validator.js";
import { submitKyc, syncKyc } from "../controllers/kyc.controller.js";

const kycRouter = Router();

kycRouter.post(
  "/",
  defaultRateLimiter,
  authenticate,
  validate(submitKycSchema),
  submitKyc,
);

// Recovery endpoint: polls Anchor for the real KYC status and reconciles local DB.
// Also triggers account creation if KYC is approved but no VirtualAccount exists.
kycRouter.post(
  "/sync",
  defaultRateLimiter,
  authenticate,
  syncKyc,
);

export default kycRouter;

