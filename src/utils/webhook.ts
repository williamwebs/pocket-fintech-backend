import crypto from "crypto";
import { ANCHOR_WEBHOOK_SECRET } from "../config/env.js";

/**
 * Verifies Anchor's x-anchor-signature header against raw request body.
 * Anchor computes: Base64(HMAC_SHA1(rawBody, secretToken).hexDigest())
 */
export const verifyAnchorSignature = (
  rawBody: Buffer | string | undefined,
  incomingSignature: string | undefined,
  secretToken = ANCHOR_WEBHOOK_SECRET,
): boolean => {
  if (!rawBody || !incomingSignature || !secretToken) {
    return false;
  }

  const hmacHex = crypto
    .createHmac("sha1", secretToken)
    .update(rawBody)
    .digest("hex");

  const expectedSignature = Buffer.from(hmacHex, "utf8").toString("base64");

  const expectedBuf = Buffer.from(expectedSignature, "utf8");
  const incomingBuf = Buffer.from(incomingSignature, "utf8");

  if (expectedBuf.length !== incomingBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, incomingBuf);
};
