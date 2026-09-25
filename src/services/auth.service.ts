import { PrismaClientKnownRequestError } from "@prisma/client/runtime/client";
import { createSession } from "../lib/session";
import { db } from "../prisma/db";
import { DUMMY_PASSWORD, hashPassword, verifyPassword } from "../utils/hash";
import { signAccessToken } from "../utils/tokens";
import { SigninInput, SignupInput } from "../validators/auth.validator";
import { ApiError } from "../utils/apiError";
import logger from "../utils/logger";

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

  // if there is no user with that email or user returns null, throw an error
};
