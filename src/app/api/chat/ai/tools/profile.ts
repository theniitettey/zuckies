import type { ISession } from "@/lib/models/session";
import type { IApplicantData, OnboardingState } from "@/lib/models/session";
import Applicant from "@/lib/models/applicant";
import Session from "@/lib/models/session";
import ai from "../config";
import { z } from "genkit";
import { logToolExecution } from "./logger";

/**
 * Profile Management Tools
 *
 * Tools for managing user profile data and navigation through onboarding states.
 * These tools allow updating profile information and moving between different steps.
 *
 * Tools included:
 * - update_profile: Update any field in the user's profile
 * - change_state: Navigate to a different onboarding step
 * - find_user_profile: Look up user by email to check if returning
 * - check_application_status: Get current application review status
 *
 * @module ai/tools/profile
 */

export function createProfileTools(
  session: ISession,
  markPendingSave: () => void
) {
  const updateProfileTool = ai.defineTool(
    {
      name: "update_profile",
      description:
        "Update a user's profile information after they have completed onboarding. Use this when a user wants to change their GitHub, LinkedIn, portfolio, goals, skill level, or any other profile field. NOT for email changes.",
      inputSchema: z.object({
        field: z
          .enum([
            "name",
            "whatsapp",
            "engineering_area",
            "skill_level",
            "improvement_goals",
            "career_goals",
            "github",
            "linkedin",
            "portfolio",
            "projects",
            "time_commitment",
            "learning_style",
            "tech_focus",
            "success_definition",
          ])
          .describe("The field to update"),
        value: z.string().describe("The new value for the field"),
      }),
      outputSchema: z.string(),
    },
    async (input) => {
      logToolExecution("update_profile", input);

      const { field, value } = input;
      const oldValue = session.applicant_data[field as keyof IApplicantData];

      // URL normalization for url fields
      if (["github", "linkedin", "portfolio"].includes(field)) {
        let url = value.trim();
        url = url.replace(/^@/, ""); // Remove @ if present

        if (field === "github") {
          if (!url.includes("github.com")) {
            const usernameMatch = url.match(/([a-zA-Z0-9_-]+)\/?$/);
            if (usernameMatch) {
              url = `https://github.com/${usernameMatch[1]}`;
            }
          } else if (!url.startsWith("http")) {
            url = `https://${url}`;
          }
        } else if (field === "linkedin") {
          if (!url.includes("linkedin.com")) {
            const usernameMatch = url.match(/([a-zA-Z0-9_-]+)\/?$/);
            if (usernameMatch) {
              url = `https://linkedin.com/in/${usernameMatch[1]}`;
            }
          } else if (!url.startsWith("http")) {
            url = `https://${url}`;
          }
        } else if (field === "portfolio") {
          if (!url.startsWith("http") && url.includes(".")) {
            url = `https://${url}`;
          }
        }

        session.applicant_data[field as keyof IApplicantData] = url as never;
        console.log(`Normalized ${field} URL:`, url);
      } else {
        session.applicant_data[field as keyof IApplicantData] = value as never;
      }

      session.updated_at = new Date();
      markPendingSave();

      // Also update Applicant model if user has completed onboarding
      const email = session.applicant_data?.email;
      if (email && session.state === "COMPLETED") {
        try {
          const updateData: Record<string, unknown> = {
            [field]: session.applicant_data[field as keyof IApplicantData],
            updated_at: new Date(),
          };
          await Applicant.findOneAndUpdate({ email }, { $set: updateData });
          console.log("✅ Applicant record updated:", field);
        } catch (err) {
          console.error("Failed to update Applicant record:", err);
        }
      }

      const displayOld = oldValue || "(not set)";
      const displayNew = session.applicant_data[field as keyof IApplicantData];

      return `Profile updated! Changed ${field.replace(
        /_/g,
        " "
      )} from "${displayOld}" to "${displayNew}". Let the user know their profile has been updated.`;
    }
  );

  const changeStateTool = ai.defineTool(
    {
      name: "change_state",
      description: `Navigate to a specific onboarding state. Use this when the user wants to:
- Go back to a previous step ("go back to github", "i want to change my name")
- Jump to a specific step ("let me update my skill level", "take me to the projects section")
- Re-answer a question ("i want to redo my goals", "let me change my engineering area")

This is useful both during onboarding AND after completion if they want to revisit/update something.

States available (in order):
1. AWAITING_EMAIL - email address
2. AWAITING_SECRET_PHRASE - secret phrase for login
3. AWAITING_NAME - their name
4. AWAITING_WHATSAPP - whatsapp number
5. AWAITING_ENGINEERING_AREA - frontend/backend/fullstack/mobile
6. AWAITING_SKILL_LEVEL - beginner/intermediate/advanced
7. AWAITING_IMPROVEMENT_GOALS - what they want to improve
8. AWAITING_CAREER_GOALS - career objectives
9. AWAITING_GITHUB - github link (optional)
10. AWAITING_LINKEDIN - linkedin (optional)
11. AWAITING_PORTFOLIO - portfolio site (optional)
12. AWAITING_PROJECTS - projects they've built
13. AWAITING_TIME_COMMITMENT - hours per week
14. AWAITING_LEARNING_STYLE - how they learn best
15. AWAITING_TECH_FOCUS - technologies to focus on
16. AWAITING_SUCCESS_DEFINITION - how they define success
17. COMPLETED - finished onboarding
18. FREE_CHAT - post-completion free interaction

DO NOT change to AWAITING_EMAIL or AWAITING_SECRET_PHRASE (security-sensitive).`,
      inputSchema: z.object({
        target_state: z
          .enum([
            "AWAITING_NAME",
            "AWAITING_WHATSAPP",
            "AWAITING_ENGINEERING_AREA",
            "AWAITING_SKILL_LEVEL",
            "AWAITING_IMPROVEMENT_GOALS",
            "AWAITING_CAREER_GOALS",
            "AWAITING_GITHUB",
            "AWAITING_LINKEDIN",
            "AWAITING_PORTFOLIO",
            "AWAITING_PROJECTS",
            "AWAITING_TIME_COMMITMENT",
            "AWAITING_LEARNING_STYLE",
            "AWAITING_TECH_FOCUS",
            "AWAITING_SUCCESS_DEFINITION",
            "COMPLETED",
            "FREE_CHAT",
          ])
          .describe("The state to change to"),
        reason: z
          .string()
          .optional()
          .describe("Why the user wants to change state (for logging)"),
      }),
      outputSchema: z.string(),
    },
    async (input) => {
      logToolExecution("change_state", input);

      const { target_state, reason } = input;
      const oldState = session.state;
      const wasCompleted = oldState === "COMPLETED";

      // Get the current value for this field (if any)
      const stateFieldMap: Record<string, keyof IApplicantData> = {
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
      };

      const field = stateFieldMap[target_state];
      const currentValue = field
        ? session.applicant_data[field] || "(not set)"
        : null;

      // Human-readable state names
      const stateNames: Record<string, string> = {
        AWAITING_NAME: "name",
        AWAITING_WHATSAPP: "whatsapp number",
        AWAITING_ENGINEERING_AREA: "engineering area",
        AWAITING_SKILL_LEVEL: "skill level",
        AWAITING_IMPROVEMENT_GOALS: "improvement goals",
        AWAITING_CAREER_GOALS: "career goals",
        AWAITING_GITHUB: "github",
        AWAITING_LINKEDIN: "linkedin",
        AWAITING_PORTFOLIO: "portfolio",
        AWAITING_PROJECTS: "projects",
        AWAITING_TIME_COMMITMENT: "time commitment",
        AWAITING_LEARNING_STYLE: "learning style",
        AWAITING_TECH_FOCUS: "tech focus",
        AWAITING_SUCCESS_DEFINITION: "success definition",
      };

      // Suggested answers for each state
      const stateSuggestions: Record<string, string[]> = {
        AWAITING_NAME: ["keep current name", "change it"],
        AWAITING_WHATSAPP: ["keep current number", "new number"],
        AWAITING_ENGINEERING_AREA: [
          "frontend",
          "backend",
          "full stack",
          "mobile",
        ],
        AWAITING_SKILL_LEVEL: ["beginner", "intermediate", "advanced"],
        AWAITING_IMPROVEMENT_GOALS: [
          "system design",
          "clean code",
          "testing",
          "keep current",
        ],
        AWAITING_CAREER_GOALS: [
          "get hired",
          "freelance",
          "promotion",
          "keep current",
        ],
        AWAITING_GITHUB: ["here's my github", "skip github", "keep current"],
        AWAITING_LINKEDIN: [
          "here's my linkedin",
          "skip linkedin",
          "keep current",
        ],
        AWAITING_PORTFOLIO: [
          "here's my portfolio",
          "no portfolio",
          "keep current",
        ],
        AWAITING_PROJECTS: [
          "here are my projects",
          "still building",
          "keep current",
        ],
        AWAITING_TIME_COMMITMENT: [
          "5 hours/week",
          "10 hours/week",
          "15+ hours/week",
        ],
        AWAITING_LEARNING_STYLE: [
          "hands-on coding",
          "watching videos",
          "reading docs",
        ],
        AWAITING_TECH_FOCUS: ["javascript", "python", "rust", "keep current"],
        AWAITING_SUCCESS_DEFINITION: [
          "ship projects",
          "get hired",
          "build confidence",
        ],
      };

      // Change the state
      session.state = target_state as OnboardingState;
      session.suggestions = stateSuggestions[target_state] || [];
      markPendingSave();

      const humanState = stateNames[target_state];

      console.log(
        `State changed: ${oldState} -> ${target_state}${
          reason ? ` (reason: ${reason})` : ""
        }`
      );

      return `STATE_CHANGED: Moved from ${oldState} to ${target_state}.

${
  wasCompleted
    ? "⚠️ Note: User was in COMPLETED state - they're updating their application."
    : ""
}

Current ${humanState}: ${currentValue}

Now ask them for their ${humanState}. ${
        currentValue !== "(not set)"
          ? `Mention their current value is "${currentValue}" in case they want to keep it.`
          : ""
      }

After they respond, use save_and_continue to save the new value and advance to the next state.`;
    }
  );

  const findProfileTool = ai.defineTool(
    {
      name: "find_user_profile",
      description:
        "Look up a user's complete profile by email. Use this BEFORE save_and_continue when user provides email at AWAITING_EMAIL state to check if they're a returning user. Checks both Session and Applicant models for complete profile data. Returns whether user exists, their progress state, and all profile data.",
      inputSchema: z.object({
        email: z.string().describe("The email address to look up"),
      }),
      outputSchema: z.string(),
    },
    async (input) => {
      const normalizedEmail = input.email.toLowerCase().trim();
      logToolExecution("find_user_profile", input);

      // Check both Session and Applicant models
      const [userSession, applicant] = await Promise.all([
        Session.findOne({ "applicant_data.email": normalizedEmail }),
        Applicant.findOne({ email: normalizedEmail }),
      ]);

      // If we have an Applicant record, that's the source of truth for profile data
      if (applicant) {
        const isCurrentSession = userSession?.session_id === session.session_id;
        const hasSecretPhrase = !!applicant.secret_phrase_hash;
        const sessionState = userSession?.state || "COMPLETED";

        return `=== USER FOUND (Applicant Record) ===
      Email: ${normalizedEmail}
      Is Current Session: ${
        isCurrentSession ? "YES" : "NO - This is a DIFFERENT session"
      }
      Has Secret Phrase: ${
        hasSecretPhrase
          ? "YES - User must verify"
          : "NO - Incomplete registration"
      }
      Onboarding State: ${sessionState}
      Application Status: ${applicant.application_status || "pending"}
      
      === PROFILE DATA ===
      Name: ${applicant.name || "Not provided"}
      WhatsApp: ${applicant.whatsapp || "Not provided"}
      Engineering Area: ${applicant.engineering_area || "Not provided"}
      Skill Level: ${applicant.skill_level || "Not provided"}
      Improvement Goals: ${applicant.improvement_goals || "Not provided"}
      Career Goals: ${applicant.career_goals || "Not provided"}
      GitHub: ${applicant.github || "Not provided"}
      LinkedIn: ${applicant.linkedin || "Not provided"}
      Portfolio: ${applicant.portfolio || "Not provided"}
      Projects: ${applicant.projects || "Not provided"}
      Time Commitment: ${applicant.time_commitment || "Not provided"}
      Learning Style: ${applicant.learning_style || "Not provided"}
      Tech Focus: ${applicant.tech_focus || "Not provided"}
      Success Definition: ${applicant.success_definition || "Not provided"}
      ${applicant.submitted_at ? `Submitted At: ${applicant.submitted_at}` : ""}
      ${applicant.reviewed_at ? `Reviewed At: ${applicant.reviewed_at}` : ""}
      ${applicant.review_notes ? `Review Notes: ${applicant.review_notes}` : ""}
      Created: ${applicant.created_at?.toLocaleDateString() || "Unknown"}
      Recovery Attempts: ${applicant.recovery_attempts || 0}
      
      === NEXT STEPS ===
      ${
        isCurrentSession
          ? "This is the current user's session. Continue with normal flow."
          : hasSecretPhrase
          ? "⚠️ RETURNING USER DETECTED! After saving email with save_and_continue, the system will automatically require secret phrase verification. Tell them 'welcome back!' and ask them to enter their secret phrase."
          : "User started before but never completed registration. Their old data will be cleared when you save_and_continue with this email."
      }`;
      }

      // Fall back to Session-only lookup (for users who haven't completed onboarding)
      if (userSession) {
        const profile = userSession.applicant_data;
        const isCurrentSession = userSession.session_id === session.session_id;
        const hasSecretPhrase = !!profile.secret_phrase;
        const isCompleted = userSession.state === "COMPLETED";

        return `=== USER FOUND (Session Only) ===
      Email: ${normalizedEmail}
      Is Current Session: ${
        isCurrentSession ? "YES" : "NO - This is a DIFFERENT session"
      }
      Has Secret Phrase: ${
        hasSecretPhrase
          ? "YES - User must verify"
          : "NO - Incomplete registration"
      }
      Onboarding State: ${userSession.state}
      Application Status: ${profile.application_status || "not submitted"}
      
      === PROFILE DATA ===
      Name: ${profile.name || "Not provided"}
      WhatsApp: ${profile.whatsapp || "Not provided"}
      Engineering Area: ${profile.engineering_area || "Not provided"}
      Skill Level: ${profile.skill_level || "Not provided"}
      Improvement Goals: ${profile.improvement_goals || "Not provided"}
      Career Goals: ${profile.career_goals || "Not provided"}
      GitHub: ${profile.github || "Not provided"}
      LinkedIn: ${profile.linkedin || "Not provided"}
      Portfolio: ${profile.portfolio || "Not provided"}
      Projects: ${profile.projects || "Not provided"}
      Time Commitment: ${profile.time_commitment || "Not provided"}
      Learning Style: ${profile.learning_style || "Not provided"}
      Tech Focus: ${profile.tech_focus || "Not provided"}
      Success Definition: ${profile.success_definition || "Not provided"}
      ${isCompleted ? `Submitted At: ${profile.submitted_at || "Unknown"}` : ""}
      
      === NEXT STEPS ===
      ${
        isCurrentSession
          ? "This is the current user's session. Continue with normal flow."
          : hasSecretPhrase
          ? "⚠️ RETURNING USER DETECTED! After saving email with save_and_continue, the system will automatically require secret phrase verification. Tell them 'welcome back!' and ask them to enter their secret phrase."
          : "User started before but never set a secret phrase. Their old data will be cleared when you save_and_continue with this email."
      }`;
      }

      return `=== NO USER FOUND ===
      Email: ${normalizedEmail}
      Status: New user - no existing profile
      
      === NEXT STEPS ===
      This is a brand new user! Proceed with save_and_continue to save their email and move to the secret phrase step.`;
    }
  );

  const checkStatusTool = ai.defineTool(
    {
      name: "check_application_status",
      description:
        "Check the user's application status. Use this when they ask about their status, if they've been accepted, or want to know where they stand.",
      inputSchema: z.object({}),
      outputSchema: z.string(),
    },
    async () => {
      logToolExecution("check_application_status", {});

      // Check Applicant model first (source of truth for completed apps)
      const email = session.applicant_data?.email;
      let status = session.applicant_data?.application_status || "pending";
      let reviewNotes = session.applicant_data?.review_notes;
      let reviewedAt = session.applicant_data?.reviewed_at;

      if (email) {
        const applicant = await Applicant.findOne({ email });
        if (applicant) {
          status = applicant.application_status || "pending";
          reviewNotes = applicant.review_notes;
          reviewedAt = applicant.reviewed_at;

          // Sync back to session if different
          if (session.applicant_data.application_status !== status) {
            session.applicant_data.application_status = status;
            session.applicant_data.review_notes = reviewNotes;
            session.applicant_data.reviewed_at = reviewedAt;
            markPendingSave();
          }
        }
      }

      const name = session.applicant_data?.name || "there";

      const statusMessages: Record<string, string> = {
        pending: `Application Status: **PENDING** ⏳
        
        Hey ${name}! Your application is still being reviewed. The mentor reviews applications regularly, so hang tight! In the meantime, feel free to ask me anything about the program or update your profile if needed.`,

        accepted: `Application Status: **ACCEPTED** 🎉🎉🎉
        
        KAISHHH!!! ${name}, you made it! Welcome to the mentorship program! The mentor has reviewed your application and you're in!
        
        ${reviewNotes ? `**Mentor's note:** ${reviewNotes}` : ""}
        ${
          reviewedAt
            ? `Reviewed on: ${new Date(reviewedAt).toLocaleDateString()}`
            : ""
        }
        
        You now have full access to mentorship support. Ask me anything about coding, career advice, project ideas, or whatever you need help with!`,

        rejected: `Application Status: **NOT ACCEPTED** 
        
        Hey ${name}, I have to be real with you - your application wasn't accepted this time.
        
        ${
          reviewNotes
            ? `**Feedback:** ${reviewNotes}`
            : "This doesn't mean you can't grow and try again later!"
        }
        
        Don't let this discourage you. Keep learning, building projects, and improving your skills. You can still ask me general questions about programming and your journey.`,

        waitlisted: `Application Status: **WAITLISTED** 📋
        
        Hey ${name}! You're on the waitlist. This means your application was good, but spots are currently full.
        
        ${
          reviewNotes
            ? `**Note:** ${reviewNotes}`
            : "You'll be notified when a spot opens up!"
        }
        
        Keep building and learning in the meantime. Feel free to update your profile or ask questions while you wait.`,
      };

      return statusMessages[status] || statusMessages.pending;
    }
  );

  return [updateProfileTool, changeStateTool, findProfileTool, checkStatusTool];
}
