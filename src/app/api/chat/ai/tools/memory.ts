import type { ISession } from "@/lib/models/session";
import ai from "../config";
import { z } from "genkit";
import { logToolExecution } from "./logger";

/**
 * Conversation Memory Tools
 *
 * Tools for managing conversation context, state cleanup, and capability discovery.
 * These tools help the AI maintain context and recover from stuck states.
 *
 * Tools included:
 * - summarize_conversation: Summarize chat history and context
 * - clear_pending_states: Clear stuck/pending states to reset flow
 * - list_capabilities: Show what actions are available to the user
 *
 * @module ai/tools/memory
 */

export function createMemoryTools(
  session: ISession,
  markPendingSave: () => void
) {
  // Implementation to be moved from route.ts
  const summarizeConversationTool = ai.defineTool(
    {
      name: "summarize_conversation",
      description: `Generate a summary of the conversation history. Use this when:
1. User asks "what have we talked about?", "summarize our chat", "recap"
2. User seems confused about prior context
3. User asks "what did I say about X?"
4. The conversation is getting long and you need to recall key points
5. User returns after a break and asks "where were we?"
6. You want to reference something from earlier in the conversation

This helps maintain continuity and shows you remember the user.`,
      inputSchema: z.object({
        focus: z
          .string()
          .optional()
          .describe(
            "Optional: specific topic or aspect to focus the summary on"
          ),
        include_user_details: z
          .boolean()
          .optional()
          .describe("Include summary of user profile/application details"),
      }),
      outputSchema: z.string(),
    },
    async (input) => {
      logToolExecution("summarize_conversation", input);

      const messages = session.messages;
      const userProfile = session.applicant_data;
      const focus = input.focus?.toLowerCase();

      const totalMessages = messages.length;
      const userMessages = messages.filter((m) => m.role === "user");

      // Quick topic detection
      const topics: string[] = [];
      const allText = userMessages
        .map((m) => m.content.toLowerCase())
        .join(" ");
      if (allText.includes("meme") || allText.includes("war"))
        topics.push("meme wars");
      if (allText.includes("project")) topics.push("projects");
      if (allText.includes("career") || allText.includes("job"))
        topics.push("career");
      if (allText.includes("help") || allText.includes("stuck"))
        topics.push("help");

      // Build compact summary
      let summary = `Messages: ${totalMessages} | Topics: ${
        topics.length > 0 ? topics.join(", ") : "general chat"
      }`;

      // Add user info if requested
      if (input.include_user_details && userProfile?.name) {
        summary += ` | User: ${userProfile.name} (${
          userProfile.application_status || "pending"
        })`;
      }

      // Last 2 user messages for context
      const recentUser = userMessages.slice(-2);
      if (recentUser.length > 0) {
        summary += ` | Recent: `;
        summary += recentUser
          .map(
            (m) => m.content.slice(0, 50) + (m.content.length > 50 ? "..." : "")
          )
          .join("; ");
      }

      // Focused search if requested
      if (focus) {
        const matches = messages.filter((m) =>
          m.content.toLowerCase().includes(focus)
        );
        if (matches.length > 0) {
          summary += ` | Found ${matches.length} about "${focus}"`;
        }
      }

      console.log("✅ Generated conversation summary");
      return summary;
    }
  );

  const clearPendingStatesTool = ai.defineTool(
    {
      name: "clear_pending_states",
      description: `Clear any pending verification, recovery, or action states that might be stuck. Use this when:
1. User says "cancel", "never mind", "forget it", "stop"
2. User wants to do something else but the state seems stuck
3. Suggestions keep changing but state doesn't match user intent
4. User is confused about what's happening
5. User explicitly says they want to start over or reset

This helps fix buggy state persistence issues.`,
      inputSchema: z.object({
        reason: z.string().optional().describe("Why clearing pending states"),
      }),
      outputSchema: z.string(),
    },
    async (input) => {
      logToolExecution("clear_pending_states", input);

      const hadPendingVerification = !!session.pending_verification;
      const hadPendingRecovery = !!session.pending_recovery;
      const hadPendingAction = !!session.pending_action;

      // Clear all pending states
      session.pending_verification = undefined;
      session.pending_recovery = undefined;
      session.pending_action = null;

      markPendingSave();

      const clearedItems = [];
      if (hadPendingVerification)
        clearedItems.push("secret phrase verification");
      if (hadPendingRecovery) clearedItems.push("account recovery");
      if (hadPendingAction) clearedItems.push("pending action");

      if (clearedItems.length === 0) {
        return "No pending states to clear. The session is clean.";
      }

      console.log("✅ Cleared pending states:", clearedItems.join(", "));
      return `STATES_CLEARED: Cleared ${clearedItems.join(", ")}. 

Current state: ${session.state}
User: ${session.applicant_data?.name || "unknown"}

Ask the user what they'd like to do now. Be helpful and don't reference the cleared states unless relevant.`;
    }
  );

  const listCapabilitiesTool = ai.defineTool(
    {
      name: "list_capabilities",
      description:
        "List all the AI's capabilities. Use this when the user asks 'what can you do?', 'help', 'what are your features?', 'what commands are there?', or similar questions about your abilities.",
      inputSchema: z.object({}),
      outputSchema: z.string(),
    },
    async () => {
      logToolExecution("list_capabilities", {});

      const isCompleted = session.state === "COMPLETED";
      const userName = session.applicant_data?.name
        ? session.applicant_data.name.split(" ")[0].toLowerCase()
        : "there";

      if (isCompleted) {
        return `=== MY CAPABILITIES (POST-ONBOARDING) ===

Hey ${userName}! Here's what I can do for you:

🎯 **PROFILE & APPLICATION**
- Check your application status ("what's my status?", "am i accepted?")
- Update any profile info ("update my github", "change my goals")
- Navigate to any section to update it ("go back to skill level")
- View your session info ("show my profile")

💬 **CHAT & SUPPORT**
- Answer coding questions (I'm here to help!)
- Discuss tech, career advice, project ideas
- Share resources and learning paths
- Give feedback on your code or projects

🔗 **URL ANALYSIS**
- Analyze GitHub profiles, portfolios, websites
- Give feedback on your projects if you share links

🔥 **ROASTS**
- Playful GitHub profile roast ("roast my github @theniitettey", uses API stats)
- Playful GitHub repo roast ("roast my repo theniitettey/zuckies", analyzes README + stars)
- Gentle URL roast for portfolios/docs/projects ("roast my portfolio https://mysite.com")

🎭 **FUN STUFF**
- Have meme wars! ("let's have a meme war")
- Share memes and GIFs
- Funfool around and have a good time

🔎 **URL FETCH/DEBUG**
- Quick-read any URL for previews or debugging fetch issues

🔐 **ACCOUNT**
- Log out ("logout", "sign out")
- Check authentication status
- Extend your session if needed

📝 **FEEDBACK**
- Leave feedback about your experience
- Rate the onboarding (1-5 stars)
- Share suggestions

Present these naturally - don't just dump a list. Pick relevant ones based on what they might need!`;
      } else {
        const currentState = session.state
          .replace("AWAITING_", "")
          .toLowerCase()
          .replace(/_/g, " ");

        return `=== MY CAPABILITIES (DURING ONBOARDING) ===

Hey ${userName}! I'm helping you through the onboarding process. Here's what I can do:

📝 **ONBOARDING**
- Guide you through each step (currently on: ${currentState})
- Save your answers and progress
- Let you skip optional fields (github, linkedin, portfolio)

🔀 **NAVIGATION**
- Go back to previous steps ("go back to name", "redo my goals")
- Jump to any section ("take me to skill level")
- Let you update answers before submitting

💬 **QUESTIONS**
- Answer questions about the program
- Explain what info we need and why
- Share info about the mentor

🔥 **ROASTS**
- Light GitHub profile roasts (share handle or profile URL) — constructive and kind
- Light GitHub repo roasts (share repo URL) — analyzes README + quality
- Gentle URL roasts for portfolios/docs/projects

🔐 **ACCOUNT**
- Help returning users verify their identity
- Account recovery if you forgot your secret phrase
- Start fresh if needed

🎯 **AFTER ONBOARDING**
Once you complete onboarding, I unlock more features:
- Full chat support for coding questions
- Meme wars and fun interactions
- Profile updates anytime
- Application status tracking

Present these naturally based on context!`;
      }
    }
  );
  return [
    summarizeConversationTool,
    clearPendingStatesTool,
    listCapabilitiesTool,
  ];
}
