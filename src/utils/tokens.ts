import jwt from "jsonwebtoken";
import { TokenPayload } from "../types";
import { ACCESS_TOKEN_SECRET } from "../config/env";

export const signAccessToken = (payload: TokenPayload): string => {
    return jwt.sign(payload, ACCESS_TOKEN_SECRET!, {expiresIn: "15m"})
}

export const verifyAccessToken = (token: string): TokenPayload => {
    return jwt.verify(token, ACCESS_TOKEN_SECRET!) as TokenPayload
}