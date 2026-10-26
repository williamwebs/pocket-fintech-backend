import express from "express";
import { CORS_ORIGIN, NODE_ENV, PORT } from "./config/env.js";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import cors from "cors";
import morgan from "morgan";
import logger, { logStream } from "./utils/logger.js";
import authRouter from "./routes/auth.routes.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import userRouter from "./routes/user.routes.js";
import kycRouter from "./routes/kyc.routes.js";
import webhookRouter from "./routes/webhook.routes.js";
import jobRouter from "./routes/job.routes.js";

const app = express();

app.set("trust proxy", 1);
const morganFormat = NODE_ENV === "production" ? "combined" : "dev";

app.use(helmet());
app.use(
  cors({
    origin: (CORS_ORIGIN || "").split(",").filter(Boolean),
    credentials: true,
  }),
);
app.use(morgan(morganFormat, { stream: logStream }));

app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/user", userRouter);
app.use("/api/v1/kyc", kycRouter);
app.use("/api/v1/webhooks", webhookRouter);
app.use("/api/v1/jobs", jobRouter);

app.use((_req, res) => res.status(404).json({ error: "Not found" }));

app.use(errorMiddleware);

app.listen(PORT, () => {
  logger.info(`pocket api is running on localhost:${PORT}`);
});

export default app;
