import { db } from "../prisma/db.js";
import { enqueueAccountCreationJob } from "../lib/qstash.js";
import { createDepositAccountForUser, syncVirtualAccountNumber } from "./account.service.js";
import { ANCHOR_WEBHOOK_URL, PORT } from "../config/env.js";
import logger from "../utils/logger.js";

/**
 * Sanitizes event payload to prevent accidental logging or storage of BVN or sensitive credentials
 */
const sanitizePayload = (payload: any): any => {
  if (!payload || typeof payload !== "object") return payload;
  const clone = JSON.parse(JSON.stringify(payload));

  const mask = (obj: any) => {
    for (const key of Object.keys(obj)) {
      if (["bvn", "password", "token", "secret"].includes(key.toLowerCase())) {
        obj[key] = "[REDACTED]";
      } else if (typeof obj[key] === "object" && obj[key] !== null) {
        mask(obj[key]);
      }
    }
  };

  mask(clone);
  return clone;
};

/**
 * Finds user associated with an Anchor webhook payload
 */
const findUserFromPayload = async (payload: any) => {
  const customerId =
    payload?.data?.relationships?.customer?.data?.id ||
    payload?.data?.attributes?.customerId ||
    payload?.data?.attributes?.customer?.id ||
    (payload?.data?.type?.toLowerCase().includes("customer") ? payload?.data?.id : null);

  const userIdFromMetadata =
    payload?.data?.attributes?.metadata?.userId ||
    payload?.data?.attributes?.customer?.metadata?.userId;

  if (userIdFromMetadata) {
    const user = await db.orm.public.User.where({ id: userIdFromMetadata }).first();
    if (user) return user;
  }

  if (customerId) {
    const user = await db.orm.public.User.where({ anchorCustomerId: customerId }).first();
    if (user) return user;
  }

  return null;
};

export const handleAnchorWebhook = async (rawPayload: any) => {
  const externalId =
    rawPayload?.id ||
    rawPayload?.eventId ||
    rawPayload?.data?.id ||
    `event-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const eventType =
    rawPayload?.type ||
    rawPayload?.eventType ||
    rawPayload?.event ||
    "unknown";

  logger.info({ externalId, eventType }, "[ANCHOR_WEBHOOK] Received webhook event");

  // 1. Deduplication Check
  const existingEvent = await db.orm.public.WebhookEvent.where({
    externalId,
  }).first();

  if (existingEvent) {
    logger.info({ externalId }, "[ANCHOR_WEBHOOK] Event already recorded. Deduplicating.");
    return { deduplicated: true };
  }

  // 2. Persist WebhookEvent
  const sanitized = sanitizePayload(rawPayload);
  await db.orm.public.WebhookEvent.create({
    externalId,
    eventType,
    payload: sanitized,
    processedAt: null,
  });

  // 3. Dispatch based on eventType
  try {
    switch (eventType) {
      case "customer.identification.approved": {
        const user = await findUserFromPayload(rawPayload);
        if (!user) {
          logger.warn({ rawPayload }, "[ANCHOR_WEBHOOK] User not found for approval event");
          break;
        }

        const now = new Date().toISOString();

        await db.transaction(async (tx) => {
          await tx.orm.public.User.where({ id: user.id }).update({
            kycStatus: "APPROVED",
            kycTier: 1,
          });

          const latestKyc = await tx.orm.public.KycVerification.where({
            userId: user.id,
          }).first();

          if (latestKyc) {
            await tx.orm.public.KycVerification.where({ id: latestKyc.id }).update({
              status: "APPROVED",
              tier: 1,
              reviewedAt: now,
              lastEvent: eventType,
            });
          }
        });

        logger.info({ userId: user.id }, "[ANCHOR_WEBHOOK] KYC approved. Dispatching account creation");

        // Enqueue background account creation job via QStash
        const hostUrl = ANCHOR_WEBHOOK_URL
          ? new URL(ANCHOR_WEBHOOK_URL).origin
          : `http://localhost:${PORT || 8080}`;
        const jobUrl = `${hostUrl}/api/v1/jobs/create-account`;

        try {
          await enqueueAccountCreationJob(jobUrl, user.id);
        } catch (queueErr) {
          logger.warn(
            { error: queueErr, userId: user.id },
            "[ANCHOR_WEBHOOK] QStash enqueue failed, executing account creation directly as fallback",
          );
          await createDepositAccountForUser(user.id);
        }
        break;
      }

      case "customer.identification.rejected": {
        const user = await findUserFromPayload(rawPayload);
        if (!user) break;

        const reason =
          rawPayload?.data?.attributes?.rejectionReason ||
          rawPayload?.data?.attributes?.reason ||
          "Identity verification was rejected";

        await db.transaction(async (tx) => {
          await tx.orm.public.User.where({ id: user.id }).update({
            kycStatus: "REJECTED",
          });

          const latestKyc = await tx.orm.public.KycVerification.where({
            userId: user.id,
          }).first();

          if (latestKyc) {
            await tx.orm.public.KycVerification.where({ id: latestKyc.id }).update({
              status: "REJECTED",
              rejectionReason: reason,
              lastEvent: eventType,
              reviewedAt: new Date().toISOString(),
            });
          }
        });
        break;
      }

      case "customer.identification.manualReview": {
        const user = await findUserFromPayload(rawPayload);
        if (!user) break;

        await db.transaction(async (tx) => {
          await tx.orm.public.User.where({ id: user.id }).update({
            kycStatus: "MANUAL_REVIEW",
          });

          const latestKyc = await tx.orm.public.KycVerification.where({
            userId: user.id,
          }).first();

          if (latestKyc) {
            await tx.orm.public.KycVerification.where({ id: latestKyc.id }).update({
              status: "MANUAL_REVIEW",
              lastEvent: eventType,
            });
          }
        });
        break;
      }

      case "customer.identification.reenter_information":
      case "customer.identification.awaitingDocument": {
        const user = await findUserFromPayload(rawPayload);
        if (!user) break;

        await db.transaction(async (tx) => {
          await tx.orm.public.User.where({ id: user.id }).update({
            kycStatus: "ACTION_REQUIRED",
          });

          const latestKyc = await tx.orm.public.KycVerification.where({
            userId: user.id,
          }).first();

          if (latestKyc) {
            await tx.orm.public.KycVerification.where({ id: latestKyc.id }).update({
              status: "ACTION_REQUIRED",
              lastEvent: eventType,
            });
          }
        });
        break;
      }

      case "virtualNuban.created":
      case "accountNumber.created": {
        const anchorAccountId =
          rawPayload?.data?.relationships?.account?.data?.id ||
          rawPayload?.data?.attributes?.accountId;

        if (anchorAccountId) {
          const virtualAccount = await db.orm.public.VirtualAccount.where({
            anchorAccountId,
          }).first();

          if (virtualAccount) {
            await syncVirtualAccountNumber(virtualAccount.userId);
          }
        }
        break;
      }

      default:
        logger.info({ eventType }, "[ANCHOR_WEBHOOK] Unhandled event type logged for audit");
        break;
    }

    // Mark event as processed
    await db.orm.public.WebhookEvent.where({ externalId }).update({
      processedAt: new Date().toISOString(),
    });

    return { processed: true };
  } catch (error: any) {
    logger.error(
      { externalId, error: error.message },
      "[ANCHOR_WEBHOOK] Error processing event handler",
    );
    throw error;
  }
};
