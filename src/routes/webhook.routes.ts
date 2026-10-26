import { Router } from "express";
import { handleAnchorWebhook } from "../controllers/webhook.controller.js";

const webhookRouter = Router();

webhookRouter.post("/anchor", handleAnchorWebhook);

export default webhookRouter;
