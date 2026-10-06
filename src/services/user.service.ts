import { db } from "../prisma/db";
import { UserProfile } from "../types";
import { ApiError } from "../utils/apiError";

export const getMe = async (userId: string): Promise<UserProfile | null> => {
  const user = await db.orm.public.User.select(
    "id",
    "email",
    "name",
    "phone",
    "role",
    "kycStatus",
    "kycTier",
    "anchorCustomerId",
    "createdAt",
  )
    .where({ id: userId })
    .first();

  if (!user) throw new ApiError(404, "User not found");
  
  return user;
};
