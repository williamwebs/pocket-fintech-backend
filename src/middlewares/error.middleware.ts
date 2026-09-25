import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/apiError.js";
import { ZodError } from "zod";
import logger from "../utils/logger.js";
import { PrismaClientKnownRequestError, PrismaClientValidationError } from "@prisma/client/runtime/client";

export const errorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  let statusCode = 500;
  let message = err.message || "Server error";

  logger.error({ err, path: req.path, method: req.method }, "Request Error");

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002":
        statusCode = 400;
        message = `Duplicate value for field: ${(err.meta?.target as string[] | undefined)?.join(", ") ?? "unknown"}`;
        break;
      case "P2025":
        statusCode = 404;
        message = "Resource not found";
        break;
      case "P2003": {
        statusCode = 400;
        const field =
          (err.meta?.field_name as string | undefined) ?? "related model";
        message = `Cannot complete operation: a foreign key constraint failed on (${field}). Check that the referenced item exists or that no dependent items rely on it.`;
        break;
      }
      default:
        statusCode = 400;
        message = "Database request error";
    }
  } else if (
    err.constructor.name === "DriverAdapterError" ||
    err.name === "DriverAdapterError"
  ) {
    const rawMessage = (err as any).message || "";
    if (
      rawMessage.includes("violates RESTRICT setting of foreign key constraint")
    ) {
      statusCode = 409;
      message =
        "Cannot delete this resource because other records still depend on it.";
    } else {
      statusCode = 500;
      message = "Database error";
      logger.error({ err }, "Unhandled DriverAdapterError");
    }
  } else if (err instanceof PrismaClientValidationError) {
    statusCode = 400;
    message = "Invalid data provided";
  } else if (err instanceof ZodError) {
    statusCode = 400;
    message = err.issues.map((e) => e.message).join(", ");
  }

  return res.status(statusCode).json({
    success: false,
    error: message,
  });
};
