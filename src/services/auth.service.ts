import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import {
  createSession,
  invalidateAllUserSession,
  invalidateUserSession,
  rotateSession,
} from "../lib/session";
import { db } from "../prisma/db";
import {
  DUMMY_PASSWORD,
  hashPassword,
  hashToken,
  verifyPassword,
} from "../utils/hash";
import { signAccessToken } from "../utils/tokens";
import {
  ResetPasswordInput,
  ResetPasswordWithOtpInput,
  SigninInput,
  SignupInput,
} from "../validators/auth.validator";
import { ApiError } from "../utils/apiError";
import logger from "../utils/logger";
import { generateUserOtp } from "../lib/otp";
import { NODE_ENV } from "../config/env";

export const signup = async (
  input: SignupInput,
  metadata?: { userAgent?: string; ipAddress?: string },
) => {
  const { email, password, fullName, role, phone } = input;
  // hash password
  const hashedPassword = await hashPassword(password);
  try {
    // create user in database
    const user = await db.orm.public.User.select(
      "id",
      "email",
      "role",
      "createdAt",
    ).create({
      email,
      passwordHash: hashedPassword,
      name: fullName,
      role,
      phone,
    });
    // create session using user.id and metadata
    const { rawToken, expiresAt } = await createSession(user.id, metadata);
    // generate access token using user.id, role & email
    const accessToken = signAccessToken({ userId: user.id, role: user.role });
    return { user, accessToken, session: { rawToken, expiresAt } };
  } catch (error) {
    if (
      error instanceof PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ApiError(409, "An account with this email already exists");
    }
    logger.error(`[AUTH_SERVICE] Error creating user: ${error}`);
    throw error;
  }
};

export const signin = async (
  input: SigninInput,
  metadata?: { userAgent?: string; ip?: string },
) => {
  const { email, password } = input;

  const user = await db.orm.public.User.where({ email }).first();

  const defaultError = () => {
    throw new ApiError(400, "Invalid email or password");
  };

  if (!user) {
    // verify dummy password
    await verifyPassword(DUMMY_PASSWORD, password);
    return defaultError();
  }

  const isValid = await verifyPassword(user.passwordHash, password);

  if (!isValid) return defaultError();

  const { passwordHash: _, ...safeUser } = user;

  const { rawToken, expiresAt } = await createSession(user.id, metadata);
  const accessToken = signAccessToken({ userId: user.id, role: user.role });
  return { user: safeUser, accessToken, session: { rawToken, expiresAt } };
};

export const refresh = async (
  currentRawToken: string,
  metadata?: { userAgent?: string; ipAddress?: string },
) => {
  const newSessionResult = await rotateSession(currentRawToken, metadata);

  if (!newSessionResult) throw new ApiError(401, "Invalid session");

  const accessToken = signAccessToken({
    userId: newSessionResult.userId,
    role: newSessionResult.role,
  });

  return {
    newRefreshToken: newSessionResult.rawToken,
    expiresAt: newSessionResult.expiresAt,
    accessToken,
  };
};

export const logout = async (
  refreshToken: string,
  allDevices: boolean = false,
) => {
  const tokenHash: string = hashToken(refreshToken);

  const session = await db.orm.public.Session.where({ tokenHash }).first();

  if (!session) return;

  if (session.isRevoked) return;

  if (allDevices) {
    await invalidateAllUserSession(session.userId);
  } else {
    await invalidateUserSession(session.tokenHash);
  }
};

export const requestPasswordReset = async (input: ResetPasswordInput) => {
  const { email } = input;
  const user = await db.orm.public.User.where({ email }).first();

  if (!user) return null;

  const otp = await generateUserOtp(user.id);

  if (NODE_ENV === "development")
    logger.info(`[OTP_SERVICE] OTP code sent: ${otp}`);

  return { otp };
};

export const resetPasswordWithOtp = async (
  input: ResetPasswordWithOtpInput,
): Promise<void> => {
  const { otp, email, newPassword } = input;

  const user = await db.orm.public.User.where({ email }).first();

  if (!user) {
    await verifyPassword(DUMMY_PASSWORD, otp);
    throw new ApiError(400, "Invalid or expired verification code.");
  }

  const record = await db.orm.public.PasswordResetCode.where({
    userId: user.id,
  }).first();

  if (!record) {
    await verifyPassword(DUMMY_PASSWORD, otp);
    throw new ApiError(400, "Invalid or expired verification code.");
  }

  if (new Date(record.expiresAt).getTime() < Date.now()) {
    await db.orm.public.PasswordResetCode.where({ id: record.id }).delete();
    throw new ApiError(400, "Verification code has expired.");
  }

  if (record.attempts >= 5) {
    await db.orm.public.PasswordResetCode.where({ id: record.id }).delete();
    throw new ApiError(
      429,
      "Too many failed attempts. Please request a new code.",
    );
  }

  const isValid = await verifyPassword(record.codeHash, otp);

  if (!isValid) {
    // Atomic increment guarded by the same cap check, so two concurrent
    // wrong guesses can't both slip past the attempts limit.
    const plan = db.sql.public.passwordResetCode
      .update((f, fns) => ({
        attempts: fns.raw`${f.attempts} + 1`.returns("pg/int4@1"),
      }))
      .where((f, fns) =>
        fns.and(fns.eq(f.id, record.id), fns.lt(f.attempts, 5)),
      )
      .returning("id", "attempts")
      .build();

    const rows = await db.runtime().query(plan);

    if (rows.length === 0) {
      // Cap was already hit by a concurrent request — same response either way.
      throw new ApiError(
        429,
        "Too many failed attempts. Please request a new code.",
      );
    }

    throw new ApiError(400, "Invalid verification code.");
  }

  const hashedPassword = await hashPassword(newPassword);

  await db.transaction(async (tx) => {
    await tx.orm.public.User.where({ email }).update({
      passwordHash: hashedPassword,
    });

    await tx.orm.public.Session.where({
      userId: user.id,
      isRevoked: false,
    }).updateAll({
      isRevoked: true,
      revokedAt: new Date().toISOString(),
    });

    await tx.orm.public.PasswordResetCode.where({ id: record.id }).delete();
  });
};
