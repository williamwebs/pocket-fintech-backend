import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { verifyAnchorSignature } from "../utils/webhook.js";
import * as anchorWebhookService from "../services/anchor-webhook.service.js";
import { ApiError } from "../utils/apiError.js";

export const handleAnchorWebhook = asyncHandler(
  async (req: Request, res: Response) => {
    const signature = req.headers["x-anchor-signature"] as string | undefined;

    const isValid = verifyAnchorSignature(req.rawBody, signature);
    if (!isValid) {
      throw new ApiError(401, "Invalid webhook signature");
    }

    const result = await anchorWebhookService.handleAnchorWebhook(req.body);

    return res.status(200).json({
      success: true,
      ...result,
    });
  },
);

export const registerWebhook = asyncHandler(
  async (req: Request, res: Response) => {
    const { ANCHOR_WEBHOOK_URL, ANCHOR_WEBHOOK_SECRET } = await import("../config/env.js");
    const { anchor } = await import("../lib/anchor.js");

    const url = req.body?.url || ANCHOR_WEBHOOK_URL;
    if (!url) {
      throw new ApiError(400, "Webhook URL must be provided in request body or ANCHOR_WEBHOOK_URL env variable");
    }

    const token = req.body?.token || ANCHOR_WEBHOOK_SECRET;
    const label = req.body?.label || "pocket_backend_webhook";
    const deliveryMode = req.body?.deliveryMode || "AtLeastOnce";

    const result = await anchor.registerWebhook({
      url,
      label,
      deliveryMode,
      token,
    });

    return res.status(201).json({
      success: true,
      message: "Webhook registered successfully with Anchor",
      data: result,
    });
  },
);

export const listWebhooks = asyncHandler(
  async (_req: Request, res: Response) => {
    const { anchor } = await import("../lib/anchor.js");
    const result = await anchor.listWebhooks();

    return res.status(200).json({
      success: true,
      data: result,
    });
  },
);
