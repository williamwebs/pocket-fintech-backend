import { db } from "../prisma/db.js";
import { ApiError } from "../utils/apiError.js";
import {
  CreatePocketInput,
  UpdatePocketInput,
  UpdateSplitsInput,
} from "../validators/pocket.validator.js";
import logger from "../utils/logger.js";

/**
 * Normalizes a pocket name to its unique nameKey:
 * Lower-cased, trimmed, and internal whitespace collapsed.
 * Makes "House", " house ", and "house" collide as intended by contract.prisma.
 */
export const normalizeNameKey = (name: string): string => {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
};

/**
 * Validates that the sum of non-spending pocket split percentages does not exceed 100%.
 */
export const validateSplitCap = (nonSpendingSplits: number[]): void => {
  const total = nonSpendingSplits.reduce((acc, curr) => acc + curr, 0);
  if (total > 100) {
    throw new ApiError(
      400,
      `Total split percentage for savings/investment pockets cannot exceed 100% (currently ${total}%)`,
    );
  }
};

/**
 * Calculates deposit split amounts for a list of pockets according to the project's rounding rule:
 * - For each non-spending pocket: floor(amount * splitPercent / 100)
 * - The SPENDING pocket takes the exact remainder: amount - sum(non-spending amounts)
 *
 * Guarantees that sum(splits) === depositAmount down to the exact kobo, with zero leakage.
 */
export const calculateDepositSplits = (
  depositAmountKobo: bigint,
  pockets: Array<{ id: string; type: string; splitPercent: number | null }>,
): Array<{ pocketId: string; amountKobo: bigint }> => {
  const spendingPocket = pockets.find((p) => p.type === "SPENDING");
  if (!spendingPocket) {
    throw new ApiError(500, "User does not have an active SPENDING pocket");
  }

  const nonSpendingPockets = pockets.filter((p) => p.type !== "SPENDING");

  let totalAllocatedNonSpending = 0n;
  const allocations: Array<{ pocketId: string; amountKobo: bigint }> = [];

  for (const pocket of nonSpendingPockets) {
    const percent = BigInt(pocket.splitPercent || 0);
    // Floor division in integer arithmetic
    const pocketAmount = (depositAmountKobo * percent) / 100n;
    totalAllocatedNonSpending += pocketAmount;

    allocations.push({
      pocketId: pocket.id,
      amountKobo: pocketAmount,
    });
  }

  // Spending takes the remainder
  const spendingAmount = depositAmountKobo - totalAllocatedNonSpending;
  allocations.push({
    pocketId: spendingPocket.id,
    amountKobo: spendingAmount,
  });

  return allocations;
};

/**
 * Lists all pockets for a user with calculated spending pocket remainder percentage.
 */
export const getUserPockets = async (userId: string) => {
  const pockets = await db.orm.public.Pocket.where({ userId }).findMany();

  // Sort: SPENDING first, then by createdAt asc
  const nonSpendingSplitsSum = pockets
    .filter((p) => p.type !== "SPENDING")
    .reduce((sum, p) => sum + (p.splitPercent || 0), 0);

  const spendingRemainderPercent = Math.max(0, 100 - nonSpendingSplitsSum);

  return pockets.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    lockCategory: p.lockCategory,
    balance: p.balance.toString(), // kobo string for precision
    balanceNgn: (Number(p.balance) / 100).toFixed(2),
    splitPercent: p.type === "SPENDING" ? spendingRemainderPercent : (p.splitPercent || 0),
    isLocked: p.isLocked,
    lockedAt: p.lockedAt,
    maturityDate: p.maturityDate,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));
};

/**
 * Creates a new pocket (SAVINGS, INVESTMENT, EMERGENCY) for a user.
 */
export const createPocket = async (userId: string, input: CreatePocketInput) => {
  const { name, type, splitPercent = 0 } = input;
  const nameKey = normalizeNameKey(name);

  // 1. Check name uniqueness for this user
  const existingPocket = await db.orm.public.Pocket.where({
    userId_nameKey: { userId, nameKey },
  }).first();

  if (existingPocket) {
    throw new ApiError(409, `A pocket named "${name}" already exists`);
  }

  // 2. Validate split percentage cap (<= 100% across all non-spending pockets)
  const currentPockets = await db.orm.public.Pocket.where({ userId }).findMany();
  const currentNonSpendingSplits = currentPockets
    .filter((p) => p.type !== "SPENDING")
    .map((p) => p.splitPercent || 0);

  validateSplitCap([...currentNonSpendingSplits, splitPercent]);

  // 3. Create pocket
  const pocket = await db.orm.public.Pocket.create({
    userId,
    name: name.trim(),
    nameKey,
    type,
    balance: 0n,
    splitPercent,
    isLocked: false,
  });

  logger.info({ userId, pocketId: pocket.id, name: pocket.name }, "[POCKET] Created new pocket");

  return {
    ...pocket,
    balance: pocket.balance.toString(),
    balanceNgn: (Number(pocket.balance) / 100).toFixed(2),
  };
};

/**
 * Updates a pocket's name and/or split percentage.
 */
export const updatePocket = async (
  userId: string,
  pocketId: string,
  input: UpdatePocketInput,
) => {
  const pocket = await db.orm.public.Pocket.where({ id: pocketId }).first();

  if (!pocket || pocket.userId !== userId) {
    throw new ApiError(404, "Pocket not found");
  }

  if (pocket.type === "SPENDING") {
    if (input.name) {
      throw new ApiError(400, "The SPENDING pocket cannot be renamed");
    }
    if (input.splitPercent !== undefined) {
      throw new ApiError(
        400,
        "SPENDING pocket split percentage is automatically computed as the remainder of 100%",
      );
    }
  }

  const updates: any = {};

  // Check rename uniqueness
  if (input.name && input.name.trim() !== pocket.name) {
    const nameKey = normalizeNameKey(input.name);
    const existing = await db.orm.public.Pocket.where({
      userId_nameKey: { userId, nameKey },
    }).first();

    if (existing && existing.id !== pocketId) {
      throw new ApiError(409, `A pocket named "${input.name}" already exists`);
    }

    updates.name = input.name.trim();
    updates.nameKey = nameKey;
  }

  // Validate split percentage cap if modified
  if (input.splitPercent !== undefined && pocket.type !== "SPENDING") {
    const otherPockets = await db.orm.public.Pocket.where({ userId }).findMany();
    const otherSplits = otherPockets
      .filter((p) => p.id !== pocketId && p.type !== "SPENDING")
      .map((p) => p.splitPercent || 0);

    validateSplitCap([...otherSplits, input.splitPercent]);
    updates.splitPercent = input.splitPercent;
  }

  if (Object.keys(updates).length === 0) {
    return pocket;
  }

  const updated = await db.orm.public.Pocket.where({ id: pocketId }).update(updates);

  logger.info({ userId, pocketId }, "[POCKET] Updated pocket details");

  return {
    ...updated,
    balance: updated.balance.toString(),
    balanceNgn: (Number(updated.balance) / 100).toFixed(2),
  };
};

/**
 * Reconfigures split percentages across multiple pockets atomically.
 */
export const updateSplitPercentages = async (
  userId: string,
  input: UpdateSplitsInput,
) => {
  const userPockets = await db.orm.public.Pocket.where({ userId }).findMany();
  const pocketMap = new Map(userPockets.map((p) => [p.id, p]));

  // Ensure all provided pocket IDs belong to this user and none are the SPENDING pocket
  for (const split of input.splits) {
    const p = pocketMap.get(split.pocketId);
    if (!p) {
      throw new ApiError(404, `Pocket with ID ${split.pocketId} not found`);
    }
    if (p.type === "SPENDING") {
      throw new ApiError(
        400,
        "Cannot set split percentage directly on SPENDING pocket. It automatically takes the remainder.",
      );
    }
  }

  // Build full updated split list for validation
  const updatedSplitsMap = new Map<string, number>();
  for (const p of userPockets) {
    if (p.type !== "SPENDING") {
      updatedSplitsMap.set(p.id, p.splitPercent || 0);
    }
  }

  for (const split of input.splits) {
    updatedSplitsMap.set(split.pocketId, split.splitPercent);
  }

  validateSplitCap(Array.from(updatedSplitsMap.values()));

  // Execute updates atomically
  await db.transaction(async (tx) => {
    for (const split of input.splits) {
      await tx.orm.public.Pocket.where({ id: split.pocketId }).update({
        splitPercent: split.splitPercent,
      });
    }
  });

  logger.info({ userId, updatedCount: input.splits.length }, "[POCKET] Updated pocket splits");

  return await getUserPockets(userId);
};
