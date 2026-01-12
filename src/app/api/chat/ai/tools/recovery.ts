import type { ISession } from "@/lib/models/session";
import ai from "../config";
import { z } from "genkit";
import Applicant, {
  VERIFIABLE_FIELDS,
  MIN_VERIFICATION_SCORE,
} from "@/lib/models/applicant";
import Session from "@/lib/models/session";
import { OnboardingState } from "@/lib/models/session";
import { hashSecretPhrase } from "../utils";
import { logToolExecution } from "./logger";

/**
 * Account Recovery Tools
 *
 * Tools for helping users recover their account when they forget their secret phrase.
 * These tools implement a multi-step verification process to confirm user identity.
 *
 * Tools included:
 * - initiate_recovery: Start the account recovery flow
 * - verify_recovery_answer: Verify answers to recovery questions
 * - reset_secret_phrase: Update secret phrase after successful verification
 * - cancel_recovery: Abort the recovery process
 *
 * @module ai/tools/recovery
 */

export function createRecoveryTools(
  session: ISession,
  markPendingSave: () => void
) {
  const initiateRecoveryTool = ai.defineTool(
    {
      name: "initiate_recovery",
      description:
        "Start the account recovery process for a user who forgot their secret phrase. Call this when user says they forgot their phrase and want to recover (not start fresh). Checks both Applicant and Session models for verifiable info.",
      inputSchema: z.object({
        email: z.string().describe("The email of the account to recover"),
      }),
      outputSchema: z.string(),
    },
    async (input) => {
      const normalizedEmail = input.email.toLowerCase().trim();
      logToolExecution("initiate_recovery", input);

      // Check both Applicant model (preferred) and Session model
      const [applicant, existingSession] = await Promise.all([
        Applicant.findOne({ email: normalizedEmail }),
        Session.findOne({ "applicant_data.email": normalizedEmail }),
      ]);

      // Use Applicant model if available (source of truth for completed registrations)
      const profile = applicant || existingSession?.applicant_data;
      const hasSecretPhrase = applicant
        ? !!applicant.secret_phrase_hash
        : !!existingSession?.applicant_data?.secret_phrase;

      if (!profile && !existingSession) {
        return "NO_ACCOUNT: No account found with this email. They need to start fresh with a new registration.";
      }

      if (!hasSecretPhrase) {
        return "NO_SECRET_PHRASE: Account exists but no secret phrase was set. They can just continue registration normally.";
      }

      // Calculate what verifiable fields they have
      const availableFields = VERIFIABLE_FIELDS.filter((f) => {
        const value = profile?.[f.key as keyof typeof profile];
        return value && typeof value === "string" && value.trim().length > 0;
      });

      const totalPossibleScore = availableFields.reduce(
        (sum, f) => sum + f.weight,
        0
      );

      // Track recovery attempts for rate limiting (only for Applicant model)
      if (applicant) {
        const lastAttempt = applicant.last_recovery_attempt;
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

        // Reset attempts if the time window has expired
        if (lastAttempt && lastAttempt < hourAgo) {
          applicant.recovery_attempts = 0;
        }

        // Check if rate limited (5 attempts within the hour)
        if (applicant.recovery_attempts >= 5) {
          const timeLeft = lastAttempt
            ? Math.ceil(
                (lastAttempt.getTime() + 60 * 60 * 1000 - Date.now()) / 60000
              )
            : 0;
          return `RATE_LIMITED: Too many recovery attempts. The user has tried ${applicant.recovery_attempts} times in the past hour. Ask them to wait ${timeLeft} minutes before trying again, or try to remember their secret phrase.`;
        }

        // Update recovery attempt tracking
        applicant.recovery_attempts += 1;
        applicant.last_recovery_attempt = new Date();
        await applicant.save();
      }

      if (totalPossibleScore < MIN_VERIFICATION_SCORE) {
        // Not enough info to verify - offer to delete and start fresh
        session.pending_recovery = {
          email: normalizedEmail,
          verified_fields: [],
          verification_score: 0,
          attempts: 0,
        };
        markPendingSave();

        return `INSUFFICIENT_INFO: The account doesn't have enough verifiable information to recover.

Available info: ${availableFields.map((f) => f.label).join(", ") || "None"}
Score: ${totalPossibleScore}/${MIN_VERIFICATION_SCORE} required

Options:
1. Delete old account and start fresh (use start_fresh tool with confirm: true after they agree)
2. Try to remember their secret phrase

Tell the user they didn't provide enough unique identifying information during registration to verify their identity. Ask if they want to try remembering their phrase or start fresh (which will delete their old data).`;
      }

      // Initialize recovery state
      session.pending_recovery = {
        email: normalizedEmail,
        verified_fields: [],
        verification_score: 0,
        attempts: 0,
      };
      markPendingSave();

      // Pick the first unverified field to ask about
      const firstField = availableFields[0];
      const userName =
        applicant?.name || existingSession?.applicant_data?.name || "Not set";

      return `RECOVERY_STARTED: Account found with enough info to verify!

Email: ${normalizedEmail}
Name on account: ${userName}
Data source: ${applicant ? "Applicant (secure)" : "Session"}
Verifiable fields available: ${availableFields.map((f) => f.label).join(", ")}
Total verification score possible: ${totalPossibleScore}/${MIN_VERIFICATION_SCORE} required

Ask them to verify their ${
        firstField.label
      }. After they answer, use verify_recovery_answer to check it.
DO NOT tell them what values are on file - ask them to provide the info themselves.`;
    }
  );

  const verifyRecoveryAnswerTool = ai.defineTool(
    {
      name: "verify_recovery_answer",
      description:
        "Verify a user's answer during account recovery. Call this after asking them a verification question.",
      inputSchema: z.object({
        field: z
          .string()
          .describe(
            "The field being verified: github, linkedin, portfolio, whatsapp, name, or engineering_area"
          ),
        user_answer: z
          .string()
          .describe("What the user provided as their answer"),
      }),
      outputSchema: z.string(),
    },
    async (input) => {
      logToolExecution("verify_recovery_answer", input);

      if (!session.pending_recovery) {
        return "ERROR: No recovery in progress. Use initiate_recovery first.";
      }

      // Check both Applicant and Session models
      const [applicant, existingSession] = await Promise.all([
        Applicant.findOne({ email: session.pending_recovery.email }),
        Session.findOne({
          "applicant_data.email": session.pending_recovery.email,
        }),
      ]);

      if (!applicant && !existingSession) {
        session.pending_recovery = undefined;
        markPendingSave();
        return "ERROR: Account no longer exists. Recovery cancelled.";
      }

      // Use Applicant model as source of truth if available
      const profile = applicant || existingSession?.applicant_data;
      const storedValue = profile?.[input.field as keyof typeof profile];
      const fieldConfig = VERIFIABLE_FIELDS.find((f) => f.key === input.field);

      if (!fieldConfig || !storedValue) {
        return `ERROR: Field '${input.field}' is not available for verification.`;
      }

      // Normalize and compare values
      const normalizedStored = String(storedValue).toLowerCase().trim();
      const normalizedAnswer = input.user_answer.toLowerCase().trim();

      // For URLs, extract the key part (username/path)
      let isMatch = false;
      if (
        input.field === "github" ||
        input.field === "linkedin" ||
        input.field === "portfolio"
      ) {
        // Extract username/path from both
        const storedPath = normalizedStored
          .replace(/^https?:\/\//, "")
          .replace(/^www\./, "")
          .replace(/\/$/, "");
        const answerPath = normalizedAnswer
          .replace(/^https?:\/\//, "")
          .replace(/^www\./, "")
          .replace(/\/$/, "")
          .replace(/^@/, "");

        isMatch =
          storedPath.includes(answerPath) || answerPath.includes(storedPath);
      } else if (input.field === "whatsapp") {
        // Compare just digits
        const storedDigits = normalizedStored.replace(/\D/g, "");
        const answerDigits = normalizedAnswer.replace(/\D/g, "");
        isMatch =
          storedDigits === answerDigits ||
          storedDigits.endsWith(answerDigits) ||
          answerDigits.endsWith(storedDigits);
      } else {
        // Exact or fuzzy match for name/engineering_area
        isMatch =
          normalizedStored === normalizedAnswer ||
          normalizedStored.includes(normalizedAnswer) ||
          normalizedAnswer.includes(normalizedStored);
      }

      session.pending_recovery.attempts += 1;

      if (isMatch) {
        // Add to verified fields and update score
        if (!session.pending_recovery.verified_fields.includes(input.field)) {
          session.pending_recovery.verified_fields.push(input.field);
          session.pending_recovery.verification_score += fieldConfig.weight;
        }
        markPendingSave();

        // Check if we've reached the threshold
        if (
          session.pending_recovery.verification_score >= MIN_VERIFICATION_SCORE
        ) {
          return `VERIFIED: ✅ ${fieldConfig.label} matches!

Identity verified! Score: ${session.pending_recovery.verification_score}/${MIN_VERIFICATION_SCORE}

The user has proven their identity. Now use reset_secret_phrase tool to let them set a new secret phrase.`;
        }

        // Need more verification - find next field
        const availableFields = VERIFIABLE_FIELDS.filter((f) => {
          const value = profile?.[f.key as keyof typeof profile];
          return (
            value &&
            typeof value === "string" &&
            value.trim().length > 0 &&
            !session.pending_recovery?.verified_fields.includes(f.key)
          );
        });

        if (availableFields.length === 0) {
          return `PARTIAL_VERIFIED: ✅ ${fieldConfig.label} matches, but score is only ${session.pending_recovery.verification_score}/${MIN_VERIFICATION_SCORE}.

No more fields to verify. They don't have enough info on file. Ask if they want to try remembering their phrase or start fresh.`;
        }

        const nextField = availableFields[0];
        return `CORRECT: ✅ ${fieldConfig.label} matches!

Current score: ${
          session.pending_recovery.verification_score
        }/${MIN_VERIFICATION_SCORE} required
Need ${
          MIN_VERIFICATION_SCORE - session.pending_recovery.verification_score
        } more points.

Ask them to verify their ${nextField.label} next.`;
      } else {
        markPendingSave();

        if (session.pending_recovery.attempts >= 5) {
          return `FAILED: ❌ Too many incorrect attempts (${session.pending_recovery.attempts}).

For security, recovery is locked. They can:
1. Try remembering their secret phrase
2. Start fresh with a new account (will delete old data)`;
        }

        return `INCORRECT: ❌ ${fieldConfig.label} doesn't match our records.

Attempts: ${session.pending_recovery.attempts}/5
Ask if they want to try again with the correct ${fieldConfig.label}, verify a different field, or give up.`;
      }
    }
  );

  const resetSecretPhraseTool = ai.defineTool(
    {
      name: "reset_secret_phrase",
      description:
        "Reset a user's secret phrase after successful identity verification during recovery. Only call this after verify_recovery_answer returns VERIFIED. Updates both Applicant and Session models.",
      inputSchema: z.object({
        new_phrase: z
          .string()
          .describe("The new secret phrase chosen by the user"),
      }),
      outputSchema: z.string(),
    },
    async (input) => {
      logToolExecution("reset_secret_phrase", input);

      if (!session.pending_recovery) {
        return "ERROR: No recovery in progress.";
      }

      if (
        session.pending_recovery.verification_score < MIN_VERIFICATION_SCORE
      ) {
        return `ERROR: Identity not sufficiently verified. Score: ${session.pending_recovery.verification_score}/${MIN_VERIFICATION_SCORE} required.`;
      }

      const recoveryEmail = session.pending_recovery.email;

      // Check both Applicant and Session models
      const [applicant, existingSession] = await Promise.all([
        Applicant.findOne({ email: recoveryEmail }),
        Session.findOne({ "applicant_data.email": recoveryEmail }),
      ]);

      if (!applicant && !existingSession) {
        session.pending_recovery = undefined;
        markPendingSave();
        return "ERROR: Account no longer exists.";
      }

      // Hash the new secret phrase
      const hashedPhrase = hashSecretPhrase(input.new_phrase);

      // Update Applicant model if exists (source of truth)
      if (applicant) {
        applicant.secret_phrase_hash = hashedPhrase;
        applicant.recovery_attempts = 0; // Reset recovery attempts on successful recovery
        applicant.updated_at = new Date();
        await applicant.save();
        console.log("✅ Updated Applicant model with new secret phrase");
      }

      // Also update Session model if exists
      if (existingSession) {
        existingSession.applicant_data.secret_phrase = hashedPhrase;
        await existingSession.save();

        // Set up this session to continue as the recovered user
        session.applicant_data = { ...existingSession.applicant_data };
        session.applicant_data.secret_phrase = hashedPhrase;
        session.state = existingSession.state;

        // Delete the old session if different from current
        if (existingSession.session_id !== session.session_id) {
          await Session.deleteOne({ session_id: existingSession.session_id });
        }
      } else if (applicant) {
        // Only Applicant record exists, set up session from it
        session.applicant_data = {
          email: applicant.email,
          secret_phrase: hashedPhrase,
          name: applicant.name,
          whatsapp: applicant.whatsapp,
          engineering_area: applicant.engineering_area,
          skill_level: applicant.skill_level,
          improvement_goals: applicant.improvement_goals,
          career_goals: applicant.career_goals,
          github: applicant.github,
          linkedin: applicant.linkedin,
          portfolio: applicant.portfolio,
          projects: applicant.projects,
          time_commitment: applicant.time_commitment,
          learning_style: applicant.learning_style,
          tech_focus: applicant.tech_focus,
          success_definition: applicant.success_definition,
          application_status: applicant.application_status,
          submitted_at: applicant.submitted_at,
          review_notes: applicant.review_notes,
          reviewed_at: applicant.reviewed_at,
        };
        session.state = "FREE_CHAT" as OnboardingState; // Applicant records are for completed users - put in FREE_CHAT mode
        // Link session to the standalone Applicant record
        session.applicant_email = applicant.email;
      }

      session.pending_recovery = undefined;
      session.pending_verification = undefined;
      markPendingSave();

      console.log("✅ Secret phrase reset successfully for:", recoveryEmail);

      return `SUCCESS: Secret phrase has been reset!

Welcome back ${
        session.applicant_data.name || ""
      }! Your account has been recovered and you can continue where you left off.

Current state: ${session.state}
${
  session.state === "COMPLETED"
    ? "Your application is already submitted!"
    : "Let's continue your onboarding."
}`;
    }
  );

  const cancelRecoveryTool = ai.defineTool(
    {
      name: "cancel_recovery",
      description: "Cancel an ongoing recovery process.",
      inputSchema: z.object({}),
      outputSchema: z.string(),
    },
    async () => {
      logToolExecution("cancel_recovery", {});

      if (!session.pending_recovery) {
        return "No recovery was in progress.";
      }

      session.pending_recovery = undefined;
      markPendingSave();

      return "Recovery cancelled. Ask what they'd like to do instead - try their secret phrase again, start fresh, or something else.";
    }
  );

  return [
    initiateRecoveryTool,
    verifyRecoveryAnswerTool,
    resetSecretPhraseTool,
    cancelRecoveryTool,
  ];
}
