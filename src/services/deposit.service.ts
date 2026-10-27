import { db } from "../prisma/db.js";
import { anchor, AnchorInboundTransferResource } from "../lib/anchor.js";
import { calculateDepositSplits } from "./pocket.service.js";
import { ApiError } from "../utils/apiError.js";
import logger from "../utils/logger.js";

interface ProcessDepositCompletedInput {
  transferId: string;
  webhookEventId?: string;
  depositAccountId?: string;
}

/**
 * Handles the completed inbound NIP transfer event:
 * 1. Fetches full transfer details from Anchor (amount, sender info, status)
 * 2. Checks money idempotency via Deposit.anchorTransferId
 * 3. Identifies the user via VirtualAccount.anchorAccountId
 * 4. Executes atomic transaction:
 *    - Creates or updates Deposit record with status COMPLETED
 *    - Allocates 100% of the deposit to the user's SPENDING pocket
 *    - Updates the SPENDING pocket balance
 *    - Writes the immutable LedgerEntry (CREDIT / DEPOSIT_SPLIT)
 */
export const processDepositCompleted = async (input: ProcessDepositCompletedInput) => {
  const { transferId, webhookEventId, depositAccountId } = input;

  if (!transferId) {
    throw new ApiError(400, "Transfer ID is required to process deposit");
  }

  // 1. Fetch Inbound Transfer details from Anchor outside DB transaction
  let transferResource: AnchorInboundTransferResource;
  try {
    transferResource = await anchor.getInboundTransfer(transferId);
  } catch (err: any) {
    logger.error(
      { transferId, error: err.message },
      "[DEPOSIT] Failed to fetch InboundNIPTransfer details from Anchor",
    );
    throw new ApiError(502, `Failed to fetch transfer from Anchor: ${err.message}`);
  }

  const { attributes, relationships } = transferResource;
  const transferStatus = (attributes?.status || "").toUpperCase();
  const amountKobo = BigInt(attributes?.amount || 0);

  if (amountKobo <= 0n) {
    logger.warn({ transferId, amount: attributes?.amount }, "[DEPOSIT] Invalid deposit amount received");
    throw new ApiError(400, "Deposit amount must be greater than zero");
  }

  const anchorAccountId =
    depositAccountId ||
    relationships?.account?.data?.id ||
    transferResource.attributes?.accountId;

  if (!anchorAccountId) {
    throw new ApiError(400, "Unable to resolve target DepositAccount for transfer");
  }

  // 2. Locate Platform User via VirtualAccount
  const virtualAccount = await db.orm.public.VirtualAccount.where({
    anchorAccountId,
  }).first();

  if (!virtualAccount) {
    logger.error(
      { transferId, anchorAccountId },
      "[DEPOSIT] No local VirtualAccount matches the target Anchor Deposit Account",
    );
    throw new ApiError(404, `VirtualAccount not found for deposit account: ${anchorAccountId}`);
  }

  const userId = virtualAccount.userId;

  // 3. Check Money Idempotency
  const existingDeposit = await db.orm.public.Deposit.where({
    anchorTransferId: transferId,
  }).first();

  if (existingDeposit && existingDeposit.status === "COMPLETED") {
    logger.info(
      { transferId, userId },
      "[DEPOSIT] Deposit already completed and credited. Skipping duplicate.",
    );
    return {
      status: "COMPLETED",
      deduplicated: true,
      depositId: existingDeposit.id,
    };
  }

  // 4. Locate All User Pockets for Deposit Split
  const userPockets = await db.orm.public.Pocket.where({
    userId,
  }).findMany();

  const spendingPocket = userPockets.find((p) => p.type === "SPENDING");
  if (!spendingPocket) {
    logger.error({ userId }, "[DEPOSIT] User does not have an active SPENDING pocket");
    throw new ApiError(500, "User SPENDING pocket not found");
  }

  // Calculate split allocation per pocket (floor non-spending, spending takes remainder)
  const pocketSplits = calculateDepositSplits(amountKobo, userPockets);
  const batchReference = `deposit:${transferId}`;
  const now = new Date().toISOString();

  // 5. Atomic Transaction: Record Deposit, Update Pocket Balances, Write LedgerEntries
  const result = await db.transaction(async (tx) => {
    // A. Upsert Deposit record
    let deposit;
    if (existingDeposit) {
      deposit = await tx.orm.public.Deposit.where({ id: existingDeposit.id }).update({
        amount: amountKobo,
        status: "COMPLETED",
        completedAt: now,
        senderName: attributes?.sourceAccountName || null,
        senderAccountNumber: attributes?.sourceAccountNumber || null,
        senderBankName: attributes?.sourceBank?.name || null,
        sessionId: attributes?.sessionId || null,
      });
    } else {
      deposit = await tx.orm.public.Deposit.create({
        userId,
        anchorTransferId: transferId,
        anchorAccountId,
        amount: amountKobo,
        senderName: attributes?.sourceAccountName || null,
        senderAccountNumber: attributes?.sourceAccountNumber || null,
        senderBankName: attributes?.sourceBank?.name || null,
        sessionId: attributes?.sessionId || null,
        status: "COMPLETED",
        completedAt: now,
      });
    }

    const updatedPockets: Array<{ pocketId: string; newBalance: bigint }> = [];

    // B & C. Update each pocket and write corresponding LedgerEntry
    for (const split of pocketSplits) {
      if (split.amountKobo <= 0n) continue;

      const pocket = userPockets.find((p) => p.id === split.pocketId)!;
      const currentBalance = pocket.balance || 0n;
      const newBalance = currentBalance + split.amountKobo;

      await tx.orm.public.Pocket.where({ id: pocket.id }).update({
        balance: newBalance,
      });

      await tx.orm.public.LedgerEntry.create({
        pocketId: pocket.id,
        direction: "CREDIT",
        type: "DEPOSIT_SPLIT",
        amount: split.amountKobo,
        balanceAfter: newBalance,
        batchReference,
        webhookEventId: webhookEventId || null,
      });

      updatedPockets.push({ pocketId: pocket.id, newBalance });
    }

    return { deposit, updatedPockets };
  });

  logger.info(
    {
      userId,
      transferId,
      amountKobo: amountKobo.toString(),
      splitCount: result.updatedPockets.length,
      batchReference,
    },
    "[DEPOSIT] Successfully processed inbound transfer and credited pockets via split rule",
  );

  return {
    status: "COMPLETED",
    deduplicated: false,
    deposit: result.deposit,
    updatedPockets: result.updatedPockets,
  };
};

/**
 * Handles the pending inbound NIP transfer event (nip.inbound.received):
 * Pre-records the deposit with RECEIVED status.
 */
export const processDepositReceived = async (input: {
  transferId: string;
  depositAccountId?: string;
}) => {
  const { transferId, depositAccountId } = input;

  const existingDeposit = await db.orm.public.Deposit.where({
    anchorTransferId: transferId,
  }).first();

  if (existingDeposit) {
    return existingDeposit;
  }

  // Fetch transfer details to get amount and sender
  try {
    const transferResource = await anchor.getInboundTransfer(transferId);
    const { attributes, relationships } = transferResource;
    const anchorAccountId =
      depositAccountId || relationships?.account?.data?.id;

    if (!anchorAccountId) return null;

    const virtualAccount = await db.orm.public.VirtualAccount.where({
      anchorAccountId,
    }).first();

    if (!virtualAccount) return null;

    return await db.orm.public.Deposit.create({
      userId: virtualAccount.userId,
      anchorTransferId: transferId,
      anchorAccountId,
      amount: BigInt(attributes?.amount || 0),
      senderName: attributes?.sourceAccountName || null,
      senderAccountNumber: attributes?.sourceAccountNumber || null,
      senderBankName: attributes?.sourceBank?.name || null,
      sessionId: attributes?.sessionId || null,
      status: "RECEIVED",
    });
  } catch (err: any) {
    logger.warn(
      { transferId, error: err.message },
      "[DEPOSIT] Could not pre-record RECEIVED deposit event",
    );
    return null;
  }
};

/**
 * Handles payment.received webhook event (direct event payload from Anchor)
 */
export const processPaymentReceived = async (input: {
  payload: any;
  webhookEventId?: string;
}) => {
  const { payload, webhookEventId } = input;
  const payment = payload?.data?.attributes?.payment || payload?.payment;

  if (!payment) {
    throw new ApiError(400, "Payment data missing from payment.received event");
  }

  const transferId = payment.paymentId || payment.id;
  const amountKobo = BigInt(payment.amount || 0);

  if (amountKobo <= 0n) {
    logger.warn({ payment }, "[DEPOSIT] Non-positive amount in payment.received event");
    throw new ApiError(400, "Deposit amount must be greater than zero");
  }

  // Find user by settlementAccount.accountId or virtualNuban.accountNumber
  const anchorAccountId =
    payment.settlementAccount?.accountId ||
    payload?.data?.relationships?.account?.data?.id;

  const accountNumber = payment.virtualNuban?.accountNumber;

  let virtualAccount = null;
  if (anchorAccountId) {
    virtualAccount = await db.orm.public.VirtualAccount.where({
      anchorAccountId,
    }).first();
  }

  if (!virtualAccount && accountNumber) {
    virtualAccount = await db.orm.public.VirtualAccount.where({
      accountNumber,
    }).first();
  }

  if (!virtualAccount) {
    logger.error(
      { anchorAccountId, accountNumber, transferId },
      "[DEPOSIT] Could not locate VirtualAccount for payment.received",
    );
    throw new ApiError(404, "Target VirtualAccount not found for payment");
  }

  const userId = virtualAccount.userId;

  // Money Idempotency Check
  const existingDeposit = await db.orm.public.Deposit.where({
    anchorTransferId: transferId,
  }).first();

  if (existingDeposit && existingDeposit.status === "COMPLETED") {
    logger.info(
      { transferId, userId },
      "[DEPOSIT] Payment already recorded and credited. Skipping duplicate.",
    );
    return {
      status: "COMPLETED",
      deduplicated: true,
      depositId: existingDeposit.id,
    };
  }

  // Find All User Pockets for Deposit Split
  const userPockets = await db.orm.public.Pocket.where({
    userId,
  }).findMany();

  const spendingPocket = userPockets.find((p) => p.type === "SPENDING");
  if (!spendingPocket) {
    logger.error({ userId }, "[DEPOSIT] User SPENDING pocket not found");
    throw new ApiError(500, "User SPENDING pocket not found");
  }

  const pocketSplits = calculateDepositSplits(amountKobo, userPockets);
  const batchReference = `deposit:${transferId}`;
  const now = new Date().toISOString();

  // Atomic Transaction
  const result = await db.transaction(async (tx) => {
    let deposit;
    if (existingDeposit) {
      deposit = await tx.orm.public.Deposit.where({ id: existingDeposit.id }).update({
        amount: amountKobo,
        status: "COMPLETED",
        completedAt: now,
        senderName: payment.counterParty?.accountName || null,
        senderAccountNumber: payment.counterParty?.accountNumber || null,
        senderBankName: payment.counterParty?.bank?.name || null,
        sessionId: payment.paymentReference || null,
      });
    } else {
      deposit = await tx.orm.public.Deposit.create({
        userId,
        anchorTransferId: transferId,
        anchorAccountId: virtualAccount.anchorAccountId,
        amount: amountKobo,
        senderName: payment.counterParty?.accountName || null,
        senderAccountNumber: payment.counterParty?.accountNumber || null,
        senderBankName: payment.counterParty?.bank?.name || null,
        sessionId: payment.paymentReference || null,
        status: "COMPLETED",
        completedAt: now,
      });
    }

    const updatedPockets: Array<{ pocketId: string; newBalance: bigint }> = [];

    for (const split of pocketSplits) {
      if (split.amountKobo <= 0n) continue;

      const pocket = userPockets.find((p) => p.id === split.pocketId)!;
      const currentBalance = pocket.balance || 0n;
      const newBalance = currentBalance + split.amountKobo;

      await tx.orm.public.Pocket.where({ id: pocket.id }).update({
        balance: newBalance,
      });

      await tx.orm.public.LedgerEntry.create({
        pocketId: pocket.id,
        direction: "CREDIT",
        type: "DEPOSIT_SPLIT",
        amount: split.amountKobo,
        balanceAfter: newBalance,
        batchReference,
        webhookEventId: webhookEventId || null,
      });

      updatedPockets.push({ pocketId: pocket.id, newBalance });
    }

    return { deposit, updatedPockets };
  });

  logger.info(
    {
      userId,
      transferId,
      amountKobo: amountKobo.toString(),
      splitCount: result.updatedPockets.length,
      batchReference,
    },
    "[DEPOSIT] Successfully processed payment.received and credited pockets via split rule",
  );

  return {
    status: "COMPLETED",
    deduplicated: false,
    deposit: result.deposit,
    updatedPockets: result.updatedPockets,
  };
};

/**
 * Reconciles settled transactions from Anchor with the local database for a user.
 * Runs seamlessly on user profile fetch or on demand.
 * Finds any settled credit transaction on Anchor not yet in the Deposit table
 * and atomically writes the Deposit, updates Pocket balance, and creates the LedgerEntry.
 */
export const reconcileUserDeposits = async (userId: string) => {
  const virtualAccount = await db.orm.public.VirtualAccount.where({
    userId,
  }).first();

  if (!virtualAccount || !virtualAccount.anchorAccountId) {
    return { reconciledCount: 0, totalCreditedKobo: 0n };
  }

  // Fetch all user pockets to apply split rule
  const userPockets = await db.orm.public.Pocket.where({
    userId,
  }).findMany();

  const spendingPocket = userPockets.find((p) => p.type === "SPENDING");
  if (!spendingPocket) {
    return { reconciledCount: 0, totalCreditedKobo: 0n };
  }

  let txns: any[] = [];
  try {
    txns = await anchor.getAccountTransactions(virtualAccount.anchorAccountId);
  } catch (err: any) {
    logger.warn(
      { userId, error: err.message },
      "[RECONCILE] Could not fetch transactions from Anchor",
    );
    return { reconciledCount: 0, totalCreditedKobo: 0n };
  }

  if (!txns || txns.length === 0) {
    return { reconciledCount: 0, totalCreditedKobo: 0n };
  }

  let reconciledCount = 0;
  let totalCreditedKobo = 0n;

  for (const txn of txns) {
    const attrs = txn.attributes;
    const direction = (attrs?.direction || "").toLowerCase();
    const amount = BigInt(attrs?.amount || 0);

    // Only process credit settlements
    if (direction !== "credit" || amount <= 0n) {
      continue;
    }

    // Anchor txn ID (or underlying payment id) serves as idempotency key
    const transferId =
      txn.relationships?.payment?.data?.id ||
      txn.id;

    // Check if already in Deposit table
    const existing = await db.orm.public.Deposit.where({
      anchorTransferId: transferId,
    }).first();

    if (existing && existing.status === "COMPLETED") {
      continue;
    }

    const batchReference = `deposit:${transferId}`;
    const now = new Date().toISOString();
    const pocketSplits = calculateDepositSplits(amount, userPockets);

    try {
      await db.transaction(async (tx) => {
        if (existing) {
          await tx.orm.public.Deposit.where({ id: existing.id }).update({
            amount,
            status: "COMPLETED",
            completedAt: now,
          });
        } else {
          await tx.orm.public.Deposit.create({
            userId,
            anchorTransferId: transferId,
            anchorAccountId: virtualAccount.anchorAccountId,
            amount,
            status: "COMPLETED",
            completedAt: now,
            senderName: attrs?.summary || null,
          });
        }

        for (const split of pocketSplits) {
          if (split.amountKobo <= 0n) continue;

          const freshPocket = await tx.orm.public.Pocket.where({
            id: split.pocketId,
          }).first();

          const currentBal = freshPocket?.balance || 0n;
          const newBal = currentBal + split.amountKobo;

          await tx.orm.public.Pocket.where({ id: split.pocketId }).update({
            balance: newBal,
          });

          await tx.orm.public.LedgerEntry.create({
            pocketId: split.pocketId,
            direction: "CREDIT",
            type: "DEPOSIT_SPLIT",
            amount: split.amountKobo,
            balanceAfter: newBal,
            batchReference,
          });
        }
      });

      reconciledCount++;
      totalCreditedKobo += amount;

      logger.info(
        { userId, transferId, amount: amount.toString() },
        "[RECONCILE] Automatically reconciled and credited missing transaction",
      );
    } catch (err: any) {
      logger.error(
        { userId, transferId, error: err.message },
        "[RECONCILE] Failed to reconcile transaction",
      );
    }
  }

  return { reconciledCount, totalCreditedKobo };
};

