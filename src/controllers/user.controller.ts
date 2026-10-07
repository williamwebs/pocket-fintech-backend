import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as userService from "../services/user.service.js";
import { ApiError } from "../utils/apiError";
import {
  GetUserByIdParams,
  UpdateProfileInput,
} from "../validators/user.validator";

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

export const getUserById = asyncHandler(
  async (req: Request<GetUserByIdParams>, res: Response) => {
    const { userId } = req.params;
    if (!userId) throw new ApiError(400, "User ID is required");

    const userProfile = await userService.geteUserById(userId);

    return res.status(200).json({
      success: true,
      data: {
        message: "User profile retrieved successfully",
        profile: userProfile,
      },
    });
  },
);

export const updateMe = asyncHandler(
  async (req: Request<{}, any, UpdateProfileInput>, res: Response) => {
    const userId = req.user!.userId;
    const updated = await userService.updateUserProfile(userId, req.body);

    return res.status(200).json({
      success: true,
      data: {
        message: "Profile updated successfully",
        profile: updated,
      },
    });
  },
);

export const deleteMe = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  await userService.deactivateOwnAccount(userId);

  return res.status(200).json({
    success: true,
    data: { message: "Account deactivated successfully" },
  });
});

export const deleteUserById = asyncHandler(
  async (req: Request<GetUserByIdParams>, res: Response) => {
    const { userId } = req.params;
    const actingAdminId = req.user!.userId;

    await userService.deactivateUserById(userId, actingAdminId);

    return res.status(200).json({
      success: true,
      data: {
        message: "User account deactivated successfully",
      },
    });
  },
);
