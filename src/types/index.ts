export type UserRole = "USER" | "ADMIN" | "SUPERADMIN";

export type KycStatus =
  | "NOT_SUBMITTED"
  | "PENDING"
  | "ACTION_REQUIRED"
  | "MANUAL_REVIEW"
  | "APPROVED"
  | "REJECTED";

export interface TokenPayload {
  userId: string;
  role: UserRole;
}

export interface VirtualAccountSummary {
  accountNumber: string | null;
  bankName: string | null;
  bankNipCode: string | null;
  accountName: string | null;
  isFrozen: boolean;
}

export interface AddressSummary {
  addressLine_1: string;
  addressLine_2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  phone: string;
  role: UserRole;
  kycStatus: KycStatus;
  kycTier: number;
  // anchorCustomerId: string | null;
  createdAt: string;
  virtualAccount?: VirtualAccountSummary | null;
  address?: AddressSummary | null;
}
