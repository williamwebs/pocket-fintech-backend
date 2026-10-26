import { config } from "dotenv"

config({
    path: `.env.${process.env.NODE_ENV || "development"}.local`
})

export const {
  NODE_ENV,
  CORS_ORIGIN,
  PORT,
  DATABASE_URL,
  ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_SECRET,
  SESSION_COOKIE_NAME,
  ANCHOR_API_KEY,
  ANCHOR_BASE_URL,
  ANCHOR_WEBHOOK_SECRET,
  ANCHOR_WEBHOOK_URL,
  QSTASH_URL,
  QSTASH_TOKEN,
  QSTASH_CURRENT_SIGNING_KEY,
  QSTASH_NEXT_SIGNING_KEY
} = process.env;