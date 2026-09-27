import { db } from "../prisma/db";
import { generateRandomOtp, hashPassword } from "../utils/hash"

export const generateUserOtp = async (userId: string): Promise<string> => {
    const otp = generateRandomOtp();
    const codeHash = await hashPassword(otp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // code vaid for 5 minutes

    // atomic transaction to delete existing passwordHash and create a new one
    await db.transaction(async (tx) => {
        await tx.orm.public.PasswordResetCode.where({ userId }).deleteAll();

        await tx.orm.public.PasswordResetCode.create({userId, codeHash, expiresAt})
    })

    return otp;
}