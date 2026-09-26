import { Request, Response } from "express";
import { NODE_ENV, SESSION_COOKIE_NAME } from "../config/env";

const isProd = NODE_ENV === "production";
const COOKIE_NAME =
  SESSION_COOKIE_NAME ||
  "ef9509b61c5911c7c00de7d8177cc9219a3929b6820a838e051545168ae8262a";

export const setSessionCookie = (
  res: Response,
  token: string,
  expiresAt: Date,
): void => {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
};

export const getSessionCookie = (req: Request): string | undefined => {
  return req.cookies?.[COOKIE_NAME];
};

export const deleteSessionCookie = (res: Response): void => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
  });
};
