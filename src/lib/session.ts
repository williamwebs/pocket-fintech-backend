import { db } from "../prisma/db";
import { UserRole } from "../types";
import { generateRandomToken, hashToken } from "../utils/hash";
import logger from "../utils/logger";

export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface SessionMetadata {
  ip?: string;
  userAgent?: string;
}

export const createSession = async (
  userId: string,
  metadata?: SessionMetadata,
): Promise<{ rawToken: string; expiresAt: string }> => {
  // generate token and expiry date
  const rawToken = generateRandomToken();
  const expiresAtDate = new Date(Date.now() + SESSION_DURATION_MS);
  const expiresAt = expiresAtDate.toISOString();
  // save session in the db
  await db.orm.public.Session.create({
    userId,
    tokenHash: hashToken(rawToken),
    expiresAt,
    ipAddress: metadata?.ip,
    userAgent: metadata?.userAgent?.slice(0, 255),
  });
  return { rawToken, expiresAt };
};

export const rotateSession = async (
  rawToken: string,
  metadata?: SessionMetadata,
): Promise<{
  rawToken: string;
  expiresAt: Date;
  userId: string;
  role: UserRole;
} | null> => {
  const tokenHash = hashToken(rawToken);
  const oldSession = await db.orm.public.Session.where({ tokenHash }).first();

  if (!oldSession) return null;

  if (oldSession.isRevoked !== false || oldSession.revokedAt !== null) {
    logger.warn(
      {
        userId: oldSession.userId,
        ipAddress: metadata?.ip,
        userAgent: metadata?.userAgent,
        sessionId: oldSession.id,
      },
      "[SECURITY_ALERT] Revoked token reuse detected. Revoking all active sessions for user.",
    );

    await invalidateAllUserSession(oldSession.userId);

    return null;
  }

  const isExpired = new Date(oldSession.expiresAt).getTime() < Date.now();

  if (isExpired) return null;

  const user = await db.orm.public.User.where({
    id: oldSession.userId,
  }).first();
  if (!user) return null;

  const newToken = generateRandomToken();
  const newExpiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

  const newSession = await db.transaction(async (tx) => {
    const created = await tx.orm.public.Session.create({
      userId: oldSession.userId,
      tokenHash: hashToken(newToken),
      expiresAt: newExpiresAt,
      ipAddress: metadata?.ip,
      userAgent: metadata?.userAgent?.slice(0, 255),
    });

    await tx.orm.public.Session.where({ id: oldSession.id }).update({
      isRevoked: true,
      replacedByTokenId: created.id,
      revokedAt: new Date().toISOString(),
    });

    return created;
  });

  return {
    rawToken: newToken,
    expiresAt: new Date(newSession.expiresAt),
    userId: newSession.userId,
    role: user.role,
  };
};

export const invalidateAllUserSession = async (
  userId: string,
): Promise<void> => {
  await db.orm.public.Session.where({ userId, isRevoked: false }).update({
    isRevoked: true,
    revokedAt: new Date().toISOString(),
  });
};
