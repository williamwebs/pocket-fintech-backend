import { text } from "stream/consumers";
import { db } from "../prisma/db";
import { UserProfile } from "../types";
import { ApiError } from "../utils/apiError";
import { UpdateProfileInput } from "../validators/user.validator";

export const getMe = async (userId: string): Promise<UserProfile | null> => {
  const user = await db.orm.public.User.select(
    "id",
    "email",
    "name",
    "phone",
    "role",
    "kycStatus",
    "kycTier",
    "anchorCustomerId",
    "createdAt",
  )
    .where({ id: userId })
    .first();

  if (!user) throw new ApiError(404, "User not found");

  return user;
};

export const geteUserById = async (
  userId: string,
): Promise<UserProfile | null> => {
  const user = await db.orm.public.User.select(
    "id",
    "email",
    "name",
    "phone",
    "role",
    "homeAddress",
    "kycStatus",
    "kycTier",
    "anchorCustomerId",
    "createdAt",
  )
    .where({ id: userId })
    .first();

  if (!user) throw new ApiError(404, "User not found");
  return user;
};

export const updateUserProfile = async (
  userId: string,
  input: UpdateProfileInput,
): Promise<UserProfile> => {
  const existingUser = await db.orm.public.User.where({
    id: userId,
  }).first();

  if (!existingUser) throw new ApiError(404, "User not found");

  await db.orm.public.User.where({ id: userId }).update(input);

  const updatedUser = await db.orm.public.User.select(
    "id",
    "email",
    "name",
    "phone",
    "role",
    "homeAddress",
    "kycStatus",
    "kycTier",
    "anchorCustomerId",
    "createdAt",
  )
    .where({ id: userId })
    .first();

  if (!updatedUser) throw new ApiError(404, "User not found after update");

  return updatedUser;
};

export const deactivateOwnAccount = async (userId: string): Promise<void> => {
  const user = await db.orm.public.User.where({ id: userId }).first();

  if (!user) throw new ApiError(404, "User not found");

  await db.transaction(async (tx) => {
    await tx.orm.public.User.where({ id: userId }).update({
      isActive: false,
      deletedAt: new Date().toISOString(),
    });

    await tx.orm.public.Session.where({ userId, isRevoked: false }).updateAll({
      isRevoked: true,
      revokedAt: new Date().toISOString(),
    });
  });
};

export const deactivateUserById = async (
  targetUserId: string,
  actingAdminId: string,
): Promise<void> => {
  if (targetUserId === actingAdminId)
    throw new ApiError(
      400,
      "Admins cannot deactivate their own account through this route",
    );

  const user = await db.orm.public.User.where({ id: targetUserId }).first();

  if (!user) throw new ApiError(404, "User not found");

  await db.transaction(async (tx) => {
    await tx.orm.public.User.where({ id: targetUserId }).update({
      isActive: false,
    });

    await tx.orm.public.Session.where({
      userId: targetUserId,
      isRevoked: false,
    }).updateAll({ isRevoked: true, revokedAt: new Date().toISOString() });
  });
};
