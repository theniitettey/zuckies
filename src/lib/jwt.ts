import jwt from "jsonwebtoken";

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "mentorship-platform-secret-key-change-in-production";
const JWT_EXPIRY = "2h"; // 2 hours

export interface JWTPayload {
  email: string;
  sessionId: string;
  iat?: number;
  exp?: number;
}

/**
 * Sign a JWT token with email and sessionId
 */
export function signToken(payload: {
  email: string;
  sessionId: string;
}): string {
  return jwt.sign(
    {
      email: payload.email,
      sessionId: payload.sessionId,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

/**
 * Verify and decode a JWT token
 * Returns null if token is invalid or expired
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    console.error("JWT verification failed:", error);
    return null;
  }
}

/**
 * Decode a JWT token without verification (for debugging)
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Check if a token is close to expiry (within 15 minutes)
 * Used to decide if we should refresh the token
 */
export function shouldRefreshToken(token: string): boolean {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return true;

  const now = Math.floor(Date.now() / 1000);
  const fifteenMinutes = 15 * 60;

  return decoded.exp - now < fifteenMinutes;
}
