import pino from "pino";
import { NODE_ENV } from "../config/env.js";

const logger = pino({
  level: NODE_ENV === "production" ? "info" : "debug",
  transport: NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
});

export const logStream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

export default logger;
