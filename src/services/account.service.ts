import { db } from "../prisma/db.js";
import { anchor } from "../lib/anchor.js";
import { ApiError } from "../utils/apiError.js";
import logger from "../utils/logger.js";

/**
 * Creates Anchor Deposit Account and default SPENDING pocket for an approved user
 */
export const createDepositAccountForUser = async (userId: string) => {
  const user = await db.orm.public.User.where({ id: userId }).first();

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.kycStatus !== "APPROVED") {
    throw new ApiError(
      400,
      `Cannot create deposit account for user with KYC status: ${user.kycStatus}`,
    );
  }

  if (!user.anchorCustomerId) {
    throw new ApiError(400, "User does not have an Anchor customer ID");
  }

  // Idempotency check: if VirtualAccount already exists, return existing
  const existingAccount = await db.orm.public.VirtualAccount.where({
    userId,
  }).first();

  if (existingAccount) {
    logger.info({ userId }, "[ACCOUNT] VirtualAccount already exists for user");
    return existingAccount;
  }

  // 1. Call Anchor API to create Deposit Account
  const accountResource = await anchor.createDepositAccount(user.anchorCustomerId);

  // 2. Persist VirtualAccount and create default SPENDING pocket atomically
  const virtualAccount = await db.transaction(async (tx) => {
    const createdAccount = await tx.orm.public.VirtualAccount.create({
      userId,
      anchorAccountId: accountResource.id,
      isFrozen: false,
    });

    // Check if SPENDING pocket already exists
    const existingPocket = await tx.orm.public.Pocket.where({
      userId,
      nameKey: "spending",
    }).first();

    if (!existingPocket) {
      await tx.orm.public.Pocket.create({
        userId,
        name: "Spending",
        nameKey: "spending",
        type: "SPENDING",
        balance: 0n,
        isLocked: false,
      });
    }

    return createdAccount;
  });

  logger.info(
    { userId, anchorAccountId: accountResource.id },
    "[ACCOUNT] Created deposit account and default spending pocket",
  );

  // 3. Attempt fetching account numbers immediately in case they are already generated
  try {
    await syncVirtualAccountNumber(userId);
  } catch (err: any) {
    logger.info(
      { userId, error: err.message },
      "[ACCOUNT] Account number not yet available synchronously; awaiting webhook event",
    );
  }

  return virtualAccount;
};

/**
 * Syncs the virtual account numbers for a user from Anchor
 */
export const syncVirtualAccountNumber = async (userId: string) => {
  const virtualAccount = await db.orm.public.VirtualAccount.where({
    userId,
  }).first();

  if (!virtualAccount) return null;

  // If already populated, return it
  if (virtualAccount.accountNumber) return virtualAccount;

  const accountNumbers = await anchor.getAccountNumbers(
    virtualAccount.anchorAccountId,
  );

  if (!accountNumbers || accountNumbers.length === 0) {
    return virtualAccount;
  }

  const primaryNumber = accountNumbers[0];

  await db.orm.public.VirtualAccount.where({ id: virtualAccount.id }).update({
    accountNumber: primaryNumber.attributes.accountNumber,
    bankName: primaryNumber.attributes.bankName || null,
    bankNipCode: primaryNumber.attributes.bankNipCode || null,
    accountName: primaryNumber.attributes.accountName || null,
    anchorAccountNumberId: primaryNumber.id,
  });

  logger.info(
    { userId, accountNumber: primaryNumber.attributes.accountNumber },
    "[ACCOUNT] Successfully synced account number from Anchor",
  );

  return await db.orm.public.VirtualAccount.where({
    id: virtualAccount.id,
  }).first();
};
