import { db } from "../prisma/db";
import { hashPassword } from "../utils/hash";
import { SignupInput } from "../validators/auth.validator";

export const signup = async (
  input: SignupInput,
  metadata?: { userAgent?: string; ipAddress?: string },
) => {
  const { email, password, fullName, role, phone } = input;
  // hash password
  const hashedPassword = await hashPassword(password);
  try {
    // create user in database
    const user = await db.orm.public.User.select(
      "id",
      "email",
      "role",
      "createdAt",
    ).create({
      email,
      passwordHash: hashedPassword,
      name: fullName,
      role,
      phone,
    });
    // create session using user.id and metadata
    // generate access token using user.id, role & email
  } catch (error) {
    console.error(error);
  }
};
