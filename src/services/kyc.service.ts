import { db } from "../prisma/db.js";
import { anchor } from "../lib/anchor.js";
import { SubmitKycInput } from "../validators/kyc.validator.js";
import { ApiError } from "../utils/apiError.js";
import { createDepositAccountForUser } from "./account.service.js";
import logger from "../utils/logger.js";

/**
 * Anchor error messages that indicate KYC is actually already approved.
 * When we see these, we should treat the submission as successful.
 */
const ALREADY_COMPLETED_MESSAGES = [
  "kyc already completed",
  "verification already completed",
  "customer already verified",
];

/**
 * Anchor error messages that mean the BVN was consumed by another customer.
 * The user needs to use a different BVN (or in production, this means a duplicate identity).
 */
const BVN_ALREADY_EXISTS_MESSAGES = [
  "bvn already exists in this organization",
];

const isAlreadyCompletedError = (message: string): boolean =>
  ALREADY_COMPLETED_MESSAGES.some((m) => message.toLowerCase().includes(m));

const isBvnAlreadyExistsError = (message: string): boolean =>
  BVN_ALREADY_EXISTS_MESSAGES.some((m) => message.toLowerCase().includes(m));

export const submitKyc = async (userId: string, input: SubmitKycInput) => {
  const user = await db.orm.public.User.where({ id: userId }).first();

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // If KYC is already approved, nothing to do
  if (user.kycStatus === "APPROVED") {
    throw new ApiError(409, "KYC verification is already approved");
  }

  // Allow resubmission when PENDING (previous attempt may have failed after DB write but before Anchor call)
  // Block only MANUAL_REVIEW — the user must wait for review to complete
  if (user.kycStatus === "MANUAL_REVIEW") {
    throw new ApiError(
      409,
      "KYC verification cannot be submitted while under manual review",
    );
  }

  const {
    firstName,
    lastName,
    middleName,
    maidenName,
    dateOfBirth,
    gender,
    bvn,
    address,
  } = input;

  let customerId = user.anchorCustomerId;

  // 1. Ensure Anchor Customer exists (Tier 0)
  if (!customerId) {
    // change the phone number from +23490** to 090**
    const formattedPhoneNumber = user.phone.startsWith("+234")
      ? `0${user.phone.slice(4)}`
      : user.phone;
    
    const customer = await anchor.createIndividualCustomer({
      userId: user.id,
      email: user.email,
      phoneNumber: formattedPhoneNumber,
      fullName: {
        firstName,
        lastName,
        middleName,
        maidenName,
      },
      address: {
        addressLine_1: address.addressLine_1,
        addressLine_2: address.addressLine_2,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country,
      },
    });

    customerId = customer.id;

    // Immediately persist anchorCustomerId so retries won't create duplicate Anchor customers
    await db.orm.public.User.where({ id: user.id }).update({
      anchorCustomerId: customerId,
    });
  } else {
    // Attempt updating customer details if already created on Anchor
    try {
      await anchor.updateIndividualCustomer(customerId, {
        fullName: { firstName, lastName, middleName, maidenName },
        address: {
          addressLine_1: address.addressLine_1,
          addressLine_2: address.addressLine_2,
          city: address.city,
          state: address.state,
          postalCode: address.postalCode,
          country: address.country,
        },
      });
    } catch (err: any) {
      logger.warn(
        { customerId, error: err.message },
        "[KYC] Customer update failed or customer is locked; continuing with verification",
      );
    }
  }

  // 2. Persist Address & KycVerification record atomically
  //    Deduplication: reuse existing PENDING record instead of creating duplicates
  await db.transaction(async (tx) => {
    const existingAddress = await tx.orm.public.Address.where({
      userId: user.id,
    }).first();

    if (existingAddress) {
      await tx.orm.public.Address.where({ userId: user.id }).update({
        addressLine_1: address.addressLine_1,
        addressLine_2: address.addressLine_2 || null,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country,
      });
    } else {
      await tx.orm.public.Address.create({
        userId: user.id,
        addressLine_1: address.addressLine_1,
        addressLine_2: address.addressLine_2 || null,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country,
      });
    }

    // Check for an existing PENDING KycVerification record to reuse
    const existingKyc = await tx.orm.public.KycVerification.where({
      userId: user.id,
      status: "PENDING",
    }).first();

    if (existingKyc) {
      // Update existing record instead of creating a duplicate
      await tx.orm.public.KycVerification.where({ id: existingKyc.id }).update({
        firstName,
        lastName,
        middleName: middleName || null,
        dateOfBirth,
        gender,
      });
    } else {
      // Insert new KYC verification snapshot (BVN is never persisted)
      await tx.orm.public.KycVerification.create({
        userId: user.id,
        tier: 1,
        status: "PENDING",
        firstName,
        lastName,
        middleName: middleName || null,
        dateOfBirth,
        gender,
      });
    }

    await tx.orm.public.User.where({ id: user.id }).update({
      kycStatus: "PENDING",
      name: `${firstName} ${lastName}`.trim(),
    });
  });

  // 3. Trigger BVN verification call to Anchor
  try {
    const anchorGender =
      gender === "MALE" ? "Male" : gender === "FEMALE" ? "Female" : "Others";

    await anchor.verifyIndividualCustomer({
      customerId,
      bvn,
      dateOfBirth,
      gender: anchorGender,
    });

    return {
      message: "KYC verification submitted successfully and is currently under review",
      status: "PENDING",
    };
  } catch (error: any) {
    const errorMessage = error.message || "";

    // Handle "Kyc already completed" — Anchor says the customer is already verified
    if (isAlreadyCompletedError(errorMessage)) {
      logger.info(
        { userId: user.id, customerId },
        "[KYC] Anchor says KYC already completed — treating as approved",
      );

      await handleAlreadyApproved(user.id);

      return {
        message: "KYC verification was already approved by Anchor",
        status: "APPROVED",
      };
    }

    // Handle "BVN already exists" — the BVN is consumed by another customer
    if (isBvnAlreadyExistsError(errorMessage)) {
      logger.warn(
        { userId: user.id, customerId },
        "[KYC] BVN already used by another customer in this Anchor organization",
      );

      // Set status to ACTION_REQUIRED so user can retry with different BVN
      await db.orm.public.User.where({ id: user.id }).update({
        kycStatus: "ACTION_REQUIRED",
      });

      throw new ApiError(
        409,
        "This BVN is already associated with another account. Please contact support if you believe this is an error.",
      );
    }

    // For any other Anchor error, revert to NOT_SUBMITTED so user can retry
    logger.error(
      { userId: user.id, error: errorMessage },
      "[KYC] Anchor BVN verification failed",
    );

    await db.orm.public.User.where({ id: user.id }).update({
      kycStatus: "NOT_SUBMITTED",
    });

    throw error;
  }
};

/**
 * Handles the case where Anchor has already approved this customer's KYC.
 * Updates local DB state and triggers account creation.
 */
const handleAlreadyApproved = async (userId: string) => {
  const now = new Date().toISOString();

  await db.transaction(async (tx) => {
    await tx.orm.public.User.where({ id: userId }).update({
      kycStatus: "APPROVED",
      kycTier: 1,
    });

    // Update the latest PENDING KycVerification to APPROVED
    const latestKyc = await tx.orm.public.KycVerification.where({
      userId,
      status: "PENDING",
    }).first();

    if (latestKyc) {
      await tx.orm.public.KycVerification.where({ id: latestKyc.id }).update({
        status: "APPROVED",
        tier: 1,
        reviewedAt: now,
        lastEvent: "customer.identification.approved (sync)",
      });
    }
  });

  // Trigger account creation directly (no webhook needed)
  try {
    await createDepositAccountForUser(userId);
    logger.info({ userId }, "[KYC] Account creation triggered after sync-approve");
  } catch (err: any) {
    // Don't fail the KYC response if account creation fails — it can be retried via sync
    logger.error(
      { userId, error: err.message },
      "[KYC] Account creation failed after sync-approve, can be retried via /kyc/sync",
    );
  }
};
