
/**
 * Normalizes a phone number string to E.164 format (+234...).
 * Supports standard Nigerian network formats (10 or 11 digits starting with 0/7/8/9).
 */
export const normalizePhoneNumber = (phone: string): string => {
  // 1. Remove all non-numeric characters except a leading '+'
  let cleaned = phone.trim().replace(/[^\d+]/g, "");

  // 2. Handle leading +234
  if (cleaned.startsWith("+234")) {
    cleaned = cleaned.slice(4);
  } else if (cleaned.startsWith("234")) {
    cleaned = cleaned.slice(3);
  }

  // 3. Strip leading zero if present (e.g., "09012345678" -> "9012345678")
  if (cleaned.startsWith("0")) {
    cleaned = cleaned.slice(1);
  }

  // 4. Validate national number length (Nigerian numbers are 10 digits without leading 0)
  if (!/^\d{10}$/.test(cleaned)) {
    throw new Error("Invalid Nigerian phone number length");
  }

  // 5. Prepend canonical E.164 country code
  return `+234${cleaned}`;
};
