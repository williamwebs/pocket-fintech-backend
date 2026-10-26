import { Client, Receiver } from "@upstash/qstash";
import {
  QSTASH_CURRENT_SIGNING_KEY,
  QSTASH_NEXT_SIGNING_KEY,
  QSTASH_TOKEN,
  QSTASH_URL,
} from "../config/env.js";
import logger from "../utils/logger.js";

export const qstashClient = new Client({
  token: QSTASH_TOKEN || "",
  baseUrl: QSTASH_URL || "https://qstash.upstash.io",
});

export const qstashReceiver = new Receiver({
  currentSigningKey: QSTASH_CURRENT_SIGNING_KEY || "",
  nextSigningKey: QSTASH_NEXT_SIGNING_KEY || "",
});

export interface CreateAccountJobPayload {
  userId: string;
}

/**
 * Enqueues an account creation background job via QStash
 */
export const enqueueAccountCreationJob = async (
  targetUrl: string,
  userId: string,
): Promise<string | null> => {
  if (!QSTASH_TOKEN) {
    logger.warn(
      { userId },
      "[QSTASH] Token not configured. Skipping QStash enqueue.",
    );
    return null;
  }

  try {
    const res = await qstashClient.publishJSON({
      url: targetUrl,
      body: { userId } as CreateAccountJobPayload,
      deduplicationId: `create-account:${userId}`,
      retries: 3,
    });

    logger.info({ userId, messageId: res.messageId }, "[QSTASH] Account creation job enqueued");
    return res.messageId;
  } catch (error: any) {
    logger.error(
      { userId, error: error.message },
      "[QSTASH] Failed to enqueue account creation job",
    );
    throw error;
  }
};
