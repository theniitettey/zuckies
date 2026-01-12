import type { ISession } from "@/lib/models/session";
import ai from "../config";
import { z } from "genkit";
import Session, {
  IApplicantData,
  ONBOARDING_STATES,
  OnboardingState,
} from "@/lib/models/session";
import Applicant from "@/lib/models/applicant";
import { saveDataSchema } from "../config";
import { hashSecretPhrase } from "../utils";
import { logToolExecution } from "./logger";
import { logToolExecution } from "./logger";

/**
 * Onboarding Tools
 *
 * Tools for managing the user onboarding flow through the mentorship application process.
 * These tools handle data collection, validation, and state progression.
 *
 * Tools included:
 * - save_and_continue: Save user data and advance to next onboarding step
 * - verify_secret_phrase: Verify returning user's secret phrase
 * - start_fresh: Delete old application data and start new
 * - complete_onboarding: Mark onboarding as complete and transition to FREE_CHAT
 * - set_suggestions: Set clickable button suggestions for the user
 *
 * @module ai/tools/onboarding
 */

export function createOnboardingTools(
  session: ISession,
  markPendingSave: () => void
) {
  const getToolDescription = () => {
    // If this is a returning user at secret phrase step, don't use save_and_continue
    if (
      session.state === "AWAITING_SECRET_PHRASE" &&
      session.pending_verification
    ) {
      return "Save NEW user data. **DO NOT USE THIS TOOL FOR SECRET PHRASE** - The user is a RETURNING user. Use verify_secret_phrase tool instead.";
    }

    const stateFieldMap: Record<OnboardingState, string> = {
      AWAITING_EMAIL: "email",
      AWAITING_SECRET_PHRASE: "secret_phrase",
      AWAITING_NAME: "name",
      AWAITING_WHATSAPP: "whatsapp",
      AWAITING_ENGINEERING_AREA: "engineering_area",
      AWAITING_SKILL_LEVEL: "skill_level",
      AWAITING_IMPROVEMENT_GOALS: "improvement_goals",
      AWAITING_CAREER_GOALS: "career_goals",
      AWAITING_GITHUB: "github",
      AWAITING_LINKEDIN: "linkedin",
      AWAITING_PORTFOLIO: "portfolio",
      AWAITING_PROJECTS: "projects",
      AWAITING_TIME_COMMITMENT: "time_commitment",
      AWAITING_LEARNING_STYLE: "learning_style",
      AWAITING_TECH_FOCUS: "tech_focus",
      AWAITING_SUCCESS_DEFINITION: "success_definition",
      COMPLETED: "",
      FREE_CHAT: "",
    };

    const currentField = stateFieldMap[session.state];
    if (!currentField) {
      return "Save user data and advance to next step.";
    }

    return `**CRITICAL TOOL CALL REQUIRED NOW** - The user has provided their ${currentField.replace(
      /_/g,
      " "
    )}. You MUST immediately call this tool with the parameter { ${currentField}: "the exact value user provided" }. Do NOT skip this step. Call the tool first, then respond to the user.`;
  };

  const saveAndContinueTool = ai.defineTool(
    {
      name: "save_and_continue",
      description: getToolDescription(),
      inputSchema: saveDataSchema,
      outputSchema: z.string(),
    },
    async (input) => {
      logToolExecution("save_and_continue", input);

      const dataToSave = { ...input } as Partial<IApplicantData>;

      // Hash secret phrase before storing
      if (dataToSave.secret_phrase) {
        dataToSave.secret_phrase = hashSecretPhrase(dataToSave.secret_phrase);
        console.log("Secret phrase hashed and saved");
      }

      // Special handling for email - check if returning user
      if (dataToSave.email) {
        const normalizedEmail = dataToSave.email.toLowerCase().trim();
        dataToSave.email = normalizedEmail;

        const existingUserSession = await Session.findOne({
          "applicant_data.email": normalizedEmail,
          session_id: { $ne: session.session_id },
        });

        if (existingUserSession) {
          console.log("Found existing user with email:", normalizedEmail);

          // Check if the existing user has a secret phrase set
          const hasSecretPhrase =
            existingUserSession.applicant_data?.secret_phrase;

          if (!hasSecretPhrase) {
            // User started onboarding before but never set a secret phrase
            // Delete their old incomplete session and let them start fresh
            console.log(
              "Existing user has no secret phrase - clearing old data and starting fresh"
            );
            await Session.deleteOne({
              session_id: existingUserSession.session_id,
            });

            // Continue as new user - move to next step
            session.applicant_data.email = normalizedEmail;
            const currentIndex = ONBOARDING_STATES.indexOf(session.state);
            if (
              currentIndex >= 0 &&
              currentIndex < ONBOARDING_STATES.length - 1
            ) {
              session.state = ONBOARDING_STATES[currentIndex + 1];
            }
            markPendingSave();
            return `Email saved: ${normalizedEmail}. Note: We found an old incomplete session with this email (no secret phrase was set), so we've cleared it. You're starting fresh! Ask them to choose a new secret phrase.`;
          }

          // User has a secret phrase - require verification
          session.pending_verification = {
            existing_session_id: existingUserSession.session_id,
            existing_applicant_data: existingUserSession.applicant_data,
            existing_state: existingUserSession.state,
          };

          session.applicant_data.email = normalizedEmail;
          session.state = "AWAITING_SECRET_PHRASE";
          markPendingSave();

          return `Returning user found! Email: ${normalizedEmail}, Name: ${
            existingUserSession.applicant_data.name || "unknown"
          }. The user needs to VERIFY their secret phrase. Ask them to enter their secret phrase to verify their identity. When they respond, you MUST use the verify_secret_phrase tool, NOT save_and_continue.`;
        }
      }

      // Normalize URLs - construct full URLs from usernames
      if (dataToSave.github) {
        let github = dataToSave.github.trim();
        // Remove @ if present
        github = github.replace(/^@/, "");
        // If it's just a username (no slashes, no dots except in domain)
        if (!github.includes("github.com")) {
          // Extract username if they gave a partial URL or just username
          const usernameMatch = github.match(/([a-zA-Z0-9_-]+)\/?$/);
          if (usernameMatch) {
            github = `https://github.com/${usernameMatch[1]}`;
          }
        } else if (!github.startsWith("http")) {
          github = `https://${github}`;
        }
        dataToSave.github = github;
        console.log("Normalized GitHub URL:", github);
      }

      if (dataToSave.linkedin) {
        let linkedin = dataToSave.linkedin.trim();
        // Remove @ if present
        linkedin = linkedin.replace(/^@/, "");
        if (!linkedin.includes("linkedin.com")) {
          // It's just a username/slug
          const usernameMatch = linkedin.match(/([a-zA-Z0-9_-]+)\/?$/);
          if (usernameMatch) {
            linkedin = `https://linkedin.com/in/${usernameMatch[1]}`;
          }
        } else if (!linkedin.startsWith("http")) {
          linkedin = `https://${linkedin}`;
        }
        dataToSave.linkedin = linkedin;
        console.log("Normalized LinkedIn URL:", linkedin);
      }

      if (dataToSave.portfolio) {
        let portfolio = dataToSave.portfolio.trim();
        // Add https:// if missing and it looks like a domain
        if (!portfolio.startsWith("http") && portfolio.includes(".")) {
          portfolio = `https://${portfolio}`;
        }
        dataToSave.portfolio = portfolio;
        console.log("Normalized Portfolio URL:", portfolio);
      }

      // Merge applicant data
      session.applicant_data = { ...session.applicant_data, ...dataToSave };

      // Auto-advance state
      const currentIndex = ONBOARDING_STATES.indexOf(session.state);
      if (currentIndex < ONBOARDING_STATES.length - 1) {
        const oldState = session.state;
        session.state = ONBOARDING_STATES[currentIndex + 1];
        console.log(`State advanced: ${oldState} -> ${session.state}`);
      }

      // Mark for save at end (don't save here to avoid parallel save errors)
      markPendingSave();
      return `Data saved successfully. The new state is now ${session.state}. Acknowledge the input and ask the question for ${session.state}.`;
    }
  );

  const startFreshTool = ai.defineTool(
    {
      name: "start_fresh",
      description:
        "Clear the user's old data and let them start onboarding from scratch. Use this when a returning user can't remember their secret phrase and wants to start over. This will DELETE their old session data permanently.",
      inputSchema: z.object({
        confirm: z
          .boolean()
          .describe(
            "Must be true to confirm deletion. Only call this after the user explicitly agrees to start fresh."
          ),
      }),
      outputSchema: z.string(),
    },
    async (input) => {
      logToolExecution("start_fresh", input);

      if (!input.confirm) {
        return "Confirmation required. Ask the user to confirm they want to start fresh (this will delete their old data).";
      }

      if (!session.pending_verification) {
        return "No old session to clear. The user can continue normally.";
      }

      // Delete the old session
      const oldSessionId = session.pending_verification.existing_session_id;
      await Session.deleteOne({ session_id: oldSessionId });
      console.log("Deleted old session:", oldSessionId);

      // Clear pending verification and reset to fresh start
      const email = session.applicant_data.email;
      session.pending_verification = undefined;
      session.applicant_data = { email }; // Keep only the email
      session.state = "AWAITING_SECRET_PHRASE";
      markPendingSave();

      console.log(
        "✅ Old data cleared, starting fresh from secret phrase step"
      );
      return `Done! Old data has been cleared for ${email}. The user is now starting fresh. Ask them to choose a NEW secret phrase.`;
    }
  );

  const completeOnboardingTool = ai.defineTool(
    {
      name: "complete_onboarding",
      description:
        "Complete the onboarding process at the final step. Will check for missing required fields first.",
      inputSchema: z.object({}),
      outputSchema: z.string(),
    },
    async () => {
      // Check for required fields before completing
      const requiredFields = [
        { key: "email", label: "email" },
        { key: "secret_phrase", label: "secret phrase" },
        { key: "name", label: "name" },
        { key: "whatsapp", label: "whatsapp number" },
        { key: "engineering_area", label: "engineering area" },
        { key: "skill_level", label: "skill level" },
        { key: "improvement_goals", label: "improvement goals" },
        { key: "career_goals", label: "career goals" },
        { key: "projects", label: "projects" },
        { key: "time_commitment", label: "time commitment" },
        { key: "learning_style", label: "learning style" },
        { key: "tech_focus", label: "tech focus" },
        { key: "success_definition", label: "success definition" },
      ];

      const missingFields: string[] = [];
      for (const field of requiredFields) {
        const value = session.applicant_data[field.key as keyof IApplicantData];
        if (!value || (typeof value === "string" && value.trim() === "")) {
          missingFields.push(field.label);
        }
      }

      if (missingFields.length > 0) {
        console.log("Missing fields detected:", missingFields);
        return `Cannot complete yet! Missing required information: ${missingFields.join(
          ", "
        )}. Ask the user for these before completing.`;
      }

      // Set completion data - go directly to FREE_CHAT for natural conversation
      session.state = "FREE_CHAT" as OnboardingState;
      session.applicant_data.submitted_at = new Date().toISOString();
      session.applicant_data.application_status = "pending";

      // Create or update Applicant record (secure, standalone storage)
      const applicantData = {
        email: session.applicant_data.email,
        secret_phrase_hash: session.applicant_data.secret_phrase, // Already hashed
        name: session.applicant_data.name,
        whatsapp: session.applicant_data.whatsapp,
        engineering_area: session.applicant_data.engineering_area,
        skill_level: session.applicant_data.skill_level,
        improvement_goals: session.applicant_data.improvement_goals,
        career_goals: session.applicant_data.career_goals,
        github: session.applicant_data.github,
        linkedin: session.applicant_data.linkedin,
        portfolio: session.applicant_data.portfolio,
        projects: session.applicant_data.projects,
        time_commitment: session.applicant_data.time_commitment,
        learning_style: session.applicant_data.learning_style,
        tech_focus: session.applicant_data.tech_focus,
        success_definition: session.applicant_data.success_definition,
        submitted_at: session.applicant_data.submitted_at,
        application_status: "pending" as const,
      };

      try {
        await Applicant.findOneAndUpdate(
          { email: session.applicant_data.email },
          { $set: applicantData },
          { upsert: true, new: true }
        );
        // Link session to the Applicant record
        session.applicant_email = session.applicant_data.email;
        console.log(
          "✅ Applicant record created/updated:",
          session.applicant_data.email
        );
      } catch (err) {
        console.error("Failed to create Applicant record:", err);
        // Continue anyway - session data is still saved
      }

      markPendingSave();
      console.log("Onboarding completed!");
      return `Application submitted! All required fields are filled. The application is now PENDING REVIEW. 

IMPORTANT: Do NOT tell them they are "in the mentorship" yet! Tell them:
- Their application has been submitted successfully
- It will be reviewed by the mentor
- They can check their status anytime by asking
- They can update their profile or ask questions while waiting

Celebrate the submission, but be clear this is just the first step!`;
    }
  );

  const setSuggestionsTool = ai.defineTool(
    {
      name: "set_suggestions",
      description:
        "ALWAYS call this after responding to set helpful suggestions for the user's next message. Generate 2-4 contextual suggestions based on what you just asked them.",
      inputSchema: z.object({
        suggestions: z
          .array(z.string())
          .describe(
            "Array of 2-4 short suggestion strings relevant to the current question"
          ),
      }),
      outputSchema: z.string(),
    },
    async (input) => {
      logToolExecution("set_suggestions", input);
      session.suggestions = input.suggestions;
      // Don't save here - will be saved at the end to avoid parallel save issues
      return `Suggestions set: ${input.suggestions.join(", ")}`;
    }
  );
  return [
    saveAndContinueTool,
    startFreshTool,
    completeOnboardingTool,
    setSuggestionsTool,
  ];
}
