import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as userService from "../services/user.service.js";

export const me = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const userProfile = await userService.getMe(userId);

  return res.status(200).json({
    success: true,
    data: {
      message: "User profile retrieved successfully",
      profile: userProfile,
    },
  });
});
