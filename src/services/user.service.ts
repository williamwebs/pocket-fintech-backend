import { db } from "../prisma/db";
import { UserProfile } from "../types";
import { ApiError } from "../utils/apiError";
import { UpdateProfileInput } from "../validators/user.validator";

import { syncVirtualAccountNumber } from "./account.service.js";
import { reconcileUserDeposits } from "./deposit.service.js";

const buildUserProfile = async (user: any): Promise<UserProfile> => {
  let virtualAccount = await db.orm.public.VirtualAccount.where({
    userId: user.id,
  }).first();

  if (
    user.kycStatus === "APPROVED" &&
    virtualAccount &&
    (!virtualAccount.accountNumber ||
      !virtualAccount.bankName ||
      !virtualAccount.accountName)
  ) {
    try {
      virtualAccount = await syncVirtualAccountNumber(user.id);
    } catch {
      // Ignore background sync errors on profile query
    }
  }

  // Seamless deposit reconciliation: guarantees ledger is always up to date with settled Anchor funds
  if (user.kycStatus === "APPROVED" && virtualAccount?.anchorAccountId) {
    try {
      await reconcileUserDeposits(user.id);
    } catch {
      // Non-blocking background reconciliation
    }
  }

  const address = await db.orm.public.Address.where({
    userId: user.id,
  }).first();

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    kycStatus: user.kycStatus,
    kycTier: user.kycTier,
    // anchorCustomerId: user.anchorCustomerId,
    createdAt: user.createdAt,
    virtualAccount: virtualAccount
      ? {
          accountNumber: virtualAccount.accountNumber,
          bankName: virtualAccount.bankName,
          bankNipCode: virtualAccount.bankNipCode,
          accountName: virtualAccount.accountName,
          isFrozen: virtualAccount.isFrozen,
        }
      : null,
    address: address
      ? {
          addressLine_1: address.addressLine_1,
          addressLine_2: address.addressLine_2,
          city: address.city,
          state: address.state,
          postalCode: address.postalCode,
          country: address.country,
        }
      : null,
  };
};

export const getMe = async (userId: string): Promise<UserProfile> => {
  const user = await db.orm.public.User.where({ id: userId }).first();

  if (!user) throw new ApiError(404, "User not found");

  return await buildUserProfile(user);
};

export const getUserById = async (
  userId: string,
): Promise<UserProfile> => {
  const user = await db.orm.public.User.where({ id: userId }).first();

  if (!user) throw new ApiError(404, "User not found");
  return await buildUserProfile(user);
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

  return await getMe(userId);
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
