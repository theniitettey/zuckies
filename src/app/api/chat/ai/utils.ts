import crypto from "crypto";

// Hash function for secret phrase
export function hashSecretPhrase(phrase: string): string {
  return crypto
    .createHash("sha256")
    .update(phrase.toLowerCase().trim())
    .digest("hex");
}
