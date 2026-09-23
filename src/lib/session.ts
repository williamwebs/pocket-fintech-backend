import { db } from "../prisma/db";
import { generateRandomToken, hashToken } from "../utils/hash";

export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface SessionMetadata {
  ip?: string;
  userAgent?: string;
}

export const createSession = async (
  userId: string,
  metadata?: SessionMetadata,
): Promise<{ rawToken: string; expireAt: string }> => {
    // generate token and expiry date
    const rawToken = generateRandomToken();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)
    // save session in the db
    await db.orm.public.Session.create({userId, tokenHash: hashToken(rawToken), expiresAt})
};
