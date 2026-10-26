import { db } from "../prisma/db.js";
import { anchor } from "../lib/anchor.js";
import { SubmitKycInput } from "../validators/kyc.validator.js";
import { ApiError } from "../utils/apiError.js";
import logger from "../utils/logger.js";

export const submitKyc = async (userId: string, input: SubmitKycInput) => {
  const user = await db.orm.public.User.where({ id: userId }).first();

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // Only allow submission when not yet submitted, rejected, or action required
  if (
    user.kycStatus === "APPROVED" ||
    user.kycStatus === "PENDING" ||
    user.kycStatus === "MANUAL_REVIEW"
  ) {
    throw new ApiError(
      409,
      `KYC verification cannot be submitted when status is ${user.kycStatus.toLowerCase()}`,
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
    logger.error(
      { userId: user.id, error: error.message },
      "[KYC] Anchor BVN verification failed",
    );

    // Revert user KYC status to previous state so user can retry
    await db.orm.public.User.where({ id: user.id }).update({
      kycStatus: user.kycStatus,
    });

    throw error;
  }
};
