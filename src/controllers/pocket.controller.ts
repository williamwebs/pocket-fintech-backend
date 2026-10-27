import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as pocketService from "../services/pocket.service.js";
import {
  CreatePocketInput,
  UpdatePocketInput,
  UpdateSplitsInput,
} from "../validators/pocket.validator.js";

/**
 * List all pockets for the logged-in user
 */
export const getMyPockets = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const pockets = await pocketService.getUserPockets(userId);

  return res.status(200).json({
    success: true,
    data: {
      pockets,
    },
  });
});

/**
 * Create a new pocket
 */
export const createPocket = asyncHandler(
  async (req: Request<{}, any, CreatePocketInput>, res: Response) => {
    const userId = req.user!.userId;
    const pocket = await pocketService.createPocket(userId, req.body);

    return res.status(201).json({
      success: true,
      message: "Pocket created successfully",
      data: {
        pocket,
      },
    });
  },
);

/**
 * Update an existing pocket (name and/or split percentage)
 */
export const updatePocket = asyncHandler(
  async (
    req: Request<{ pocketId: string }, any, UpdatePocketInput>,
    res: Response,
  ) => {
    const userId = req.user!.userId;
    const { pocketId } = req.params;
    const pocket = await pocketService.updatePocket(userId, pocketId, req.body);

    return res.status(200).json({
      success: true,
      message: "Pocket updated successfully",
      data: {
        pocket,
      },
    });
  },
);

/**
 * Update split percentages across multiple pockets atomically
 */
export const updateSplits = asyncHandler(
  async (req: Request<{}, any, UpdateSplitsInput>, res: Response) => {
    const userId = req.user!.userId;
    const pockets = await pocketService.updateSplitPercentages(userId, req.body);

    return res.status(200).json({
      success: true,
      message: "Pocket split percentages updated successfully",
      data: {
        pockets,
      },
    });
  },
);
