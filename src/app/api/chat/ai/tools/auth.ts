import type { ISession } from "@/lib/models/session";
import ai from "../config";
import { z } from "genkit";
import { verifyToken, signToken } from "@/lib/jwt";
import { hashSecretPhrase } from "../utils";
import Session from "@/lib/models/session";

/**
 * Authentication Tools
 *
 * Tools for managing session authentication, token refresh, and logout.
 * These tools handle the security and session lifecycle.
 *
 * Tools included:
 * - check_auth_status: Verify if session is still valid
 * - invalidate_session: End the current session
 * - extend_session: Refresh the authentication token
 * - logout_user: Full logout with session cleanup
 * - verify_secret_phrase: Verify returning user's secret phrase
 * - get_session_info: Retrieve detailed session information
 *
 * @module ai/tools/auth
 */

export function createAuthTools(
  authContext: {
    token?: string;
    tokenEmail?: string;
    sessionId: string;
  },
  session: ISession,
  saveSession: () => Promise<void>,
  markPendingSave: () => void
) {
  const checkAuthStatusTool = ai.defineTool(
    {
      name: "check_auth_status",
      description:
        "Check the current authentication status of the user. Use this when you need to know if the user is properly authenticated, when their session expires, or to troubleshoot auth issues.",
      inputSchema: z.object({}),
      outputSchema: z.string(),
    },
    async () => {
      console.log("🛠️ Tool executing: check_auth_status");

      const hasToken = !!authContext.token;
      const hasEmail = !!session.applicant_data?.email;
      const sessionAge = session.created_at
        ? Math.round(
            (Date.now() - new Date(session.created_at).getTime()) / 1000 / 60
          )
        : 0;

      let tokenInfo = "No token present";
      let tokenExpiry = "N/A";

      if (authContext.token) {
        const decoded = verifyToken(authContext.token);
        if (decoded && decoded.exp) {
          const expiresIn = Math.round(
            (decoded.exp * 1000 - Date.now()) / 1000 / 60
          );
          tokenExpiry = expiresIn > 0 ? `${expiresIn} minutes` : "EXPIRED";
          tokenInfo = decoded.email || "No email in token";
        } else {
          tokenInfo = "Invalid or expired token";
        }
      }

      return `=== AUTH STATUS ===
Authenticated: ${hasToken && hasEmail ? "YES ✓" : "PARTIAL"}
Token Present: ${hasToken ? "YES" : "NO"}
Token Email: ${tokenInfo}
Session Email: ${session.applicant_data?.email || "Not set"}
Session ID: ${authContext.sessionId}
Session Age: ${sessionAge} minutes
Token Expires In: ${tokenExpiry}
Onboarding State: ${session.state}

=== SECURITY STATUS ===
Has Secret Phrase: ${
        session.applicant_data?.secret_phrase ? "YES (hashed)" : "NO"
      }
Email Verified: ${hasEmail ? "YES" : "NO"}
Session Valid: ${session.session_id ? "YES" : "NO"}`;
    }
  );

  const getSessionInfoTool = ai.defineTool(
    {
      name: "get_session_info",
      description:
        "Get detailed information about the current session. Use this to provide users with session details, debug issues, or when they ask about their session/account.",
      inputSchema: z.object({}),
      outputSchema: z.string(),
    },
    async () => {
      console.log("🛠️ Tool executing: get_session_info");

      const profile = session.applicant_data;
      const messageCount = session.messages?.length || 0;
      const createdAt = session.created_at
        ? new Date(session.created_at).toLocaleString()
        : "Unknown";
      const updatedAt = session.updated_at
        ? new Date(session.updated_at).toLocaleString()
        : "Unknown";

      return `=== SESSION INFO ===
Session ID: ${session.session_id.substring(
        0,
        8
      )}...${session.session_id.substring(session.session_id.length - 4)}
Created: ${createdAt}
Last Updated: ${updatedAt}
Message Count: ${messageCount}
Current State: ${session.state}

=== USER INFO ===
Email: ${profile?.email || "Not provided"}
Name: ${profile?.name || "Not provided"}
Application Status: ${profile?.application_status || "Not submitted"}

=== SESSION ACTIVITY ===
Processed Messages: ${session.processed_messages?.length || 0}
Has Pending Recovery: ${session.pending_recovery ? "YES" : "NO"}
Has Pending Action: ${session.pending_action || "NONE"}`;
    }
  );

  const invalidateSessionTool = ai.defineTool(
    {
      name: "invalidate_session",
      description:
        "Invalidate the current session for security reasons. Use this ONLY when there's a security concern like suspected unauthorized access, the user explicitly requests to secure their account, or during account recovery failures. This will force re-authentication.",
      inputSchema: z.object({
        reason: z
          .string()
          .describe(
            "The reason for invalidating the session (for logging purposes)"
          ),
      }),
      outputSchema: z.string(),
    },
    async (input) => {
      console.log("🛠️ Tool executing: invalidate_session", input.reason);

      // Mark session for logout/re-auth
      session.pending_action = "logout";

      // Clear any pending recovery to prevent abuse
      session.pending_recovery = undefined;

      markPendingSave();

      return `SESSION_INVALIDATED: Session marked for termination due to: ${input.reason}. User will need to re-authenticate. Inform them their session has been secured and they'll need to log in again.`;
    }
  );

  const extendSessionTool = ai.defineTool(
    {
      name: "extend_session",
      description:
        "Extend the user's session when they're actively engaged. Use this when the user has been chatting for a while and might be close to session expiry, or when they explicitly ask to stay logged in longer. This refreshes their authentication token.",
      inputSchema: z.object({}),
      outputSchema: z.string(),
    },
    async () => {
      console.log("🛠️ Tool executing: extend_session");

      const email = session.applicant_data?.email;
      if (!email) {
        return "CANNOT_EXTEND: User email not set. Session extension requires a verified email.";
      }

      // Generate a fresh token (will be included in response automatically)
      const newToken = signToken({ email, sessionId: session.session_id });
      const decoded = verifyToken(newToken);
      const expiresAt = decoded?.exp
        ? new Date(decoded.exp * 1000).toLocaleTimeString()
        : "2 hours from now";

      return `SESSION_EXTENDED: New token generated. Session will now expire at approximately ${expiresAt}. User can continue without interruption.`;
    }
  );

  const logoutTool = ai.defineTool(
    {
      name: "logout_user",
      description:
        "Log out the user and return them to the landing page. Use this when the user explicitly asks to log out, sign out, exit, leave, or start over with a completely new account. Say goodbye and confirm the logout.",
      inputSchema: z.object({}),
      outputSchema: z.string(),
    },
    async () => {
      console.log("🛠️ Tool executing: logout_user");

      // Mark session for logout action
      session.pending_action = "logout";
      markPendingSave();

      return "LOGOUT_TRIGGERED: User will be logged out and returned to landing page. Say a brief, friendly goodbye.";
    }
  );

  const verifySecretPhraseTool = ai.defineTool(
    {
      name: "verify_secret_phrase",
      description: session.pending_verification
        ? `**CRITICAL: RETURNING USER DETECTED** - The user is a returning user who needs to verify their identity. When they provide ANY text as their secret phrase, you MUST call this tool with { secret_phrase: "exactly what they typed" }. DO NOT use save_and_continue for secret phrases when this message appears.`
        : "Verify a returning user's secret phrase. Only use when pending_verification exists.",
      inputSchema: z.object({ secret_phrase: z.string() }),
      outputSchema: z.string(),
    },
    async (input) => {
      console.log("🛠️ Tool executing: verify_secret_phrase", input);

      if (!session.pending_verification) {
        console.log("No pending verification found");
        return "No verification pending.";
      }

      const hashedInput = hashSecretPhrase(input.secret_phrase);
      const storedHash =
        session.pending_verification.existing_applicant_data.secret_phrase;

      console.log("Comparing hashes...");

      if (hashedInput === storedHash) {
        const pendingData = session.pending_verification;
        session.applicant_data = { ...pendingData.existing_applicant_data };
        session.state = pendingData.existing_state;

        await Session.deleteOne({
          session_id: pendingData.existing_session_id,
        });
        session.pending_verification = undefined;
        markPendingSave();

        console.log(
          "✅ Secret phrase verified, session restored to:",
          session.state
        );
        return `Verified! Welcome back ${
          session.applicant_data.name
        }. Your previous session has been restored. You were at the "${session.state
          .replace("AWAITING_", "")
          .toLowerCase()
          .replace(/_/g, " ")}" step. Let's continue from there!`;
      } else {
        console.log("❌ Secret phrase verification failed");
        return "Incorrect secret phrase. The phrase doesn't match what was set before. Ask them if they want to try again OR if they want to start fresh (which will delete their old data). If they want to start fresh, use the start_fresh tool.";
      }
    }
  );

  return [
    checkAuthStatusTool,
    getSessionInfoTool,
    invalidateSessionTool,
    extendSessionTool,
    logoutTool,
    verifySecretPhraseTool,
  ];
}
