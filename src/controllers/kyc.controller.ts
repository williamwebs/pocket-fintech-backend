import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as kycService from "../services/kyc.service.js";
import * as kycSyncService from "../services/kyc-sync.service.js";
import { SubmitKycInput } from "../validators/kyc.validator.js";

export const submitKyc = asyncHandler(
  async (req: Request<{}, any, SubmitKycInput>, res: Response) => {
    const userId = req.user!.userId;
    const result = await kycService.submitKyc(userId, req.body);

    return res.status(202).json({
      success: true,
      data: result,
    });
  },
);

export const syncKyc = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user!.userId;
    const result = await kycSyncService.syncKycStatus(userId);

    return res.status(200).json({
      success: true,
      data: result,
    });
  },
);
