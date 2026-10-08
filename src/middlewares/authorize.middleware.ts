import { NextFunction, Request, Response } from "express";
import { UserRole } from "../types";
import { ApiError } from "../utils/apiError";

export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return next(new ApiError(401, "Authentication required"));

    if (!allowedRoles.includes(req.user.role as UserRole)) {
      return next(
        new ApiError(
          403,
          "Forbidden: You do not have permission to access this resource",
        ),
      );
    }
  };
};
