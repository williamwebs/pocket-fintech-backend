import argon2 from "argon2"
import { createHash, randomBytes } from "crypto";

const PASSWORD_HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MB of memory
  timeCost: 2, // 2 iterations
  parallelism: 1,
} as const;

export const hashPassword = async (plainText: string): Promise<string> => {
  return await argon2.hash(plainText, PASSWORD_HASH_OPTIONS);
};

export const generateRandomToken = (): string => {
  return randomBytes(32).toString("base64url")
}

export const hashToken = (rawToken: string): string => {
  return createHash("sha256").update(rawToken).digest("hex")
}