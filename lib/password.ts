import bcrypt from "bcryptjs";

export async function verifySharedPassword(plain: string): Promise<boolean> {
  const hash = process.env.SHARED_PASSWORD_HASH;
  if (!hash) {
    throw new Error("SHARED_PASSWORD_HASH is not configured");
  }
  return bcrypt.compare(plain, hash);
}
