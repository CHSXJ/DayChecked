import bcryptjs from "bcryptjs";

const SALT_ROUNDS = 10;

/**
 * Hashes a 4-digit PIN using bcryptjs (edge-runtime compatible).
 */
export async function hashPin(pin: string): Promise<string> {
  return bcryptjs.hash(pin, SALT_ROUNDS);
}

/**
 * Verifies a plain PIN against a stored bcrypt hash.
 */
export async function verifyPin(
  inputPin: string,
  storedHash: string
): Promise<boolean> {
  return bcryptjs.compare(inputPin, storedHash);
}

/**
 * Validates PIN format: exactly 4 digits.
 */
export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}
