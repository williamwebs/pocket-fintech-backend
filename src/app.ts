import express from "express"
import { CORS_ORIGIN, NODE_ENV, PORT } from "./config/env.js"
import helmet from "helmet"
import cookieParser from "cookie-parser"
import cors from "cors"
import morgan from "morgan"
import logger, { logStream } from "./utils/logger.js"

const app = express()

app.set("trust proxy", 1)
const morganFormat = NODE_ENV === "production" ? "combined" : "dev"

app.use(helmet())
app.use(cors({
    origin: (CORS_ORIGIN || "").split(",").filter(Boolean),
    credentials: true
}))
app.use(morgan(morganFormat, {stream: logStream}))

app.use(express.json())
app.use(cookieParser())

app.get("/health", (_req, res)=> res.json({status: "ok"}))

app.use((_req, res) => res.status(404).json({ error: "Not found" }))
// middleware for handling errors

app.listen(PORT, () => {
    logger.info(`pocket api is running on localhost:${PORT}`)
})

export default app;

