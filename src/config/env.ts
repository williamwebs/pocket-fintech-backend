import { config } from "dotenv"

config({
    path: `.env.${process.env.NODE_ENV || "development"}.local`
})

export const { NODE_ENV, CORS_ORIGIN, PORT, DATABASE_URL } = process.env;