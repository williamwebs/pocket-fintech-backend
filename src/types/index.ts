export type UserRole = "USER" | "ADMIN" | "SUPERADMIN";

export type KycStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface TokenPayload {
  userId: string;
  role: UserRole;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  phone: string;
  role: UserRole;
  kycStatus: KycStatus;
  kycTier: number;
  anchorCustomerId: string | null;
  createdAt: string;
}
