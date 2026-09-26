import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as authService from "../services/auth.service.js";
import { getSessionCookie, setSessionCookie } from "../utils/cookie";
import { ApiError } from "../utils/apiError";
import { success } from "zod";

export const signup = asyncHandler(async (req: Request, res: Response) => {
  const { user, accessToken, session } = await authService.signup(req.body, {
    userAgent: req.headers["user-agent"],
    ipAddress: req.ip,
  });
  // set session cookies
  setSessionCookie(res, session.rawToken, new Date(session.expiresAt));

  return res.status(201).json({
    success: true,
    data: { message: "User created successfully", user, accessToken },
  });
});

export const signin = asyncHandler(async (req: Request, res: Response) => {
  const { user, accessToken, session } = await authService.signin(req.body, {
    userAgent: req.headers["user-agent"],
    ip: req.ip,
  });
  // set session cookies
  setSessionCookie(res, session.rawToken, new Date(session.expiresAt));

  return res.status(200).json({
    succes: true,
    data: { message: "User signed in successfully", user, accessToken },
  });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const currentRefeshToken = getSessionCookie(req);

  if (!currentRefeshToken) throw new ApiError(401, "No refresh token");

  const metadata = {
    userAgent: req.headers["user-agent"],
    ipAddress: req.ip,
  };
  const { newRefreshToken, expiresAt, accessToken } = await authService.refresh(
    currentRefeshToken,
    metadata,
  );

  setSessionCookie(res, newRefreshToken, expiresAt);

  return res.status(200).json({
    success: true,
    data: {
      message: "Session refreshed successfully",
      accessToken,
    },
  });
});
