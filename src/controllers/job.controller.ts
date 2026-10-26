import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { qstashReceiver } from "../lib/qstash.js";
import { QSTASH_CURRENT_SIGNING_KEY } from "../config/env.js";
import * as accountService from "../services/account.service.js";
import { ApiError } from "../utils/apiError.js";

export const handleCreateAccountJob = asyncHandler(
  async (req: Request, res: Response) => {
    // Verify QStash signature if signing keys are configured
    if (QSTASH_CURRENT_SIGNING_KEY) {
      const signature = req.headers["upstash-signature"] as string | undefined;
      const rawBody = req.rawBody ? req.rawBody.toString("utf-8") : JSON.stringify(req.body);

      const isValid = await qstashReceiver
        .verify({
          signature: signature || "",
          body: rawBody,
        })
        .catch(() => false);

      if (!isValid) {
        throw new ApiError(401, "Invalid QStash signature");
      }
    }

    const { userId } = req.body;
    if (!userId) {
      throw new ApiError(400, "User ID is required in job payload");
    }

    await accountService.createDepositAccountForUser(userId);

    return res.status(200).json({
      success: true,
      message: "Deposit account and spending pocket created successfully",
    });
  },
);
