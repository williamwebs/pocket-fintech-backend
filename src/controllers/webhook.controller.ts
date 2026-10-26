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
