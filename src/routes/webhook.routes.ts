import { Router } from "express";
import {
  handleAnchorWebhook,
  registerWebhook,
  listWebhooks,
} from "../controllers/webhook.controller.js";
import { authenticate } from "../middlewares/authenticate.middleware.js";

const webhookRouter = Router();

// Inbound Anchor webhook receiver (verified via HMAC-SHA1 signature)
webhookRouter.post("/anchor", handleAnchorWebhook);

// Management endpoints (authenticated)
webhookRouter.post("/register", authenticate, registerWebhook);
webhookRouter.get("/", authenticate, listWebhooks);

export default webhookRouter;
