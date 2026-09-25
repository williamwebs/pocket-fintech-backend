export type UserRole = "USER" | "ADMIN" | "SUPERADMIN"

export interface TokenPayload {
    userId: string;
    role: UserRole;
}