import { db } from "../prisma/db.js";
import { anchor } from "../lib/anchor.js";
import { createDepositAccountForUser } from "./account.service.js";
import { ApiError } from "../utils/apiError.js";
import logger from "../utils/logger.js";

/**
 * Maps Anchor verification status strings to our KycStatus enum.
 * Anchor returns statuses like "approved", "rejected", "pending", etc.
 */
const mapAnchorStatusToKycStatus = (
  anchorStatus: string,
): "APPROVED" | "REJECTED" | "PENDING" | "ACTION_REQUIRED" | "MANUAL_REVIEW" | null => {
  const normalized = anchorStatus?.toLowerCase?.() || "";

  if (normalized.includes("approved") || normalized.includes("verified")) {
    return "APPROVED";
  }
  if (normalized.includes("rejected") || normalized.includes("denied")) {
    return "REJECTED";
  }
  if (normalized.includes("review") || normalized.includes("manual")) {
    return "MANUAL_REVIEW";
  }
  if (
    normalized.includes("action") ||
    normalized.includes("reenter") ||
    normalized.includes("document")
  ) {
    return "ACTION_REQUIRED";
  }
  if (normalized.includes("pending") || normalized.includes("processing")) {
    return "PENDING";
  }

  return null;
};

/**
 * Syncs the KYC status from Anchor's truth and triggers downstream actions
 * (account creation) if KYC is approved but no VirtualAccount exists.
 *
 * This serves as a recovery mechanism when:
 * - Webhooks weren't registered or failed to deliver
 * - The "Kyc already completed" error was missed
 * - DB state got out of sync with Anchor
 */
export const syncKycStatus = async (userId: string) => {
  const user = await db.orm.public.User.where({ id: userId }).first();
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (!user.anchorCustomerId) {
    throw new ApiError(
      400,
      "No Anchor customer linked to this user. Submit KYC first.",
    );
  }

  // 1. Fetch verification status from Anchor
  let anchorVerification;
  try {
    anchorVerification = await anchor.getCustomerVerification(
      user.anchorCustomerId,
    );
  } catch (err: any) {
    logger.error(
      { userId, customerId: user.anchorCustomerId, error: err.message },
      "[KYC_SYNC] Failed to fetch verification status from Anchor",
    );
    throw new ApiError(502, "Failed to fetch verification status from Anchor");
  }

  if (!anchorVerification) {
    return {
      message: "No verification found on Anchor for this customer",
      kycStatus: user.kycStatus,
      synced: false,
    };
  }

  const mappedStatus = mapAnchorStatusToKycStatus(anchorVerification.status);

  if (!mappedStatus) {
    logger.warn(
      { userId, anchorStatus: anchorVerification.status },
      "[KYC_SYNC] Could not map Anchor verification status",
    );
    return {
      message: `Unknown Anchor verification status: ${anchorVerification.status}`,
      kycStatus: user.kycStatus,
      synced: false,
    };
  }

  // 2. Check if anything changed
  if (user.kycStatus === mappedStatus) {
    // Status is already in sync, but check if account creation is needed
    if (mappedStatus === "APPROVED") {
      const existingAccount = await db.orm.public.VirtualAccount.where({
        userId,
      }).first();

      if (!existingAccount) {
        logger.info(
          { userId },
          "[KYC_SYNC] KYC approved but no VirtualAccount — triggering account creation",
        );
        try {
          await createDepositAccountForUser(userId);
        } catch (err: any) {
          logger.error(
            { userId, error: err.message },
            "[KYC_SYNC] Account creation failed during sync",
          );
          return {
            message: `KYC status is APPROVED but account creation failed: ${err.message}`,
            kycStatus: mappedStatus,
            synced: true,
            accountCreated: false,
          };
        }

        return {
          message: "KYC was already approved — deposit account created",
          kycStatus: mappedStatus,
          synced: true,
          accountCreated: true,
        };
      }
    }

    return {
      message: "KYC status is already in sync with Anchor",
      kycStatus: mappedStatus,
      synced: false,
    };
  }

  // 3. Update local state to match Anchor
  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    await tx.orm.public.User.where({ id: userId }).update({
      kycStatus: mappedStatus,
      ...(mappedStatus === "APPROVED" ? { kycTier: 1 } : {}),
    });

    // Update the latest KycVerification record
    const latestKyc = await tx.orm.public.KycVerification.where({
      userId,
      status: "PENDING",
    }).first();

    if (latestKyc) {
      await tx.orm.public.KycVerification.where({ id: latestKyc.id }).update({
        status: mappedStatus,
        tier: 1,
        reviewedAt: now,
        lastEvent: `sync:${anchorVerification!.status}`,
      });
    }
  });

  logger.info(
    { userId, from: user.kycStatus, to: mappedStatus },
    "[KYC_SYNC] Updated KYC status from Anchor",
  );

  // 4. If newly approved, trigger account creation
  let accountCreated = false;
  if (mappedStatus === "APPROVED") {
    const existingAccount = await db.orm.public.VirtualAccount.where({
      userId,
    }).first();

    if (!existingAccount) {
      try {
        await createDepositAccountForUser(userId);
        accountCreated = true;
        logger.info({ userId }, "[KYC_SYNC] Account creation triggered after sync");
      } catch (err: any) {
        logger.error(
          { userId, error: err.message },
          "[KYC_SYNC] Account creation failed during sync",
        );
        return {
          message: `KYC synced to APPROVED but account creation failed: ${err.message}`,
          kycStatus: mappedStatus,
          synced: true,
          accountCreated: false,
        };
      }
    }
  }

  return {
    message: `KYC status synced from ${user.kycStatus} to ${mappedStatus}`,
    kycStatus: mappedStatus,
    synced: true,
    accountCreated,
  };
};
