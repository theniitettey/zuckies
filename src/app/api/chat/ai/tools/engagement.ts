import type { ISession } from "@/lib/models/session";
import ai from "../config";
import { z } from "genkit";
import Feedback from "@/lib/models/feedback";
import { OnboardingState } from "@/lib/models/session";

/**
 * User Engagement Tools
 *
 * Tools for enhancing user interaction through memes, feedback, and content analysis.
 * These tools make the chatbot experience more engaging and fun.
 *
 * Tools included:
 * - start_meme_war: Initiate, respond to, or end meme battles
 * - submit_feedback: Collect user feedback on the experience
 * - search_giphy: Find GIFs to include in conversation
 * - analyze_url: Fetch and analyze GitHub profiles or portfolio sites
 * - transition_to_free_chat: Move user to free chat mode post-onboarding
 *
 * @module ai/tools/engagement
 */

export function createEngagementTools(
  session: ISession,
  saveSession: () => Promise<void>,
  markPendingSave: () => void
) {
  const startMemeWarTool = ai.defineTool(
    {
      name: "start_meme_war",
      description:
        "Start a meme war with the user! Use when user explicitly wants to have a meme battle. The AI and user take turns sending the funniest/most relevant memes on a chosen topic. Use search_giphy to find your memes.",
      inputSchema: z.object({
        topic: z
          .string()
          .describe(
            "The meme war topic/theme (e.g., 'programming fails', 'debugging at 3am', 'code reviews')"
          ),
        action: z
          .enum(["start", "respond", "end"])
          .describe(
            "start: begin a new meme war, respond: send your meme in an ongoing war, end: declare winner and end the war"
          ),
        winner: z
          .string()
          .optional()
          .describe(
            "When ending the war, who won? 'user', 'ai', or 'tie'. Be generous to the user!"
          ),
      }),
      outputSchema: z.string(),
    },
    async (input) => {
      console.log("🛠️ Tool executing: start_meme_war", input);

      if (input.action === "start") {
        session.pending_action = "meme_war";
        markPendingSave();
        return `MEME_WAR_STARTED: Topic is "${input.topic}". You go first! Search for a hilarious meme using search_giphy and throw your best shot. Tell the user it's their turn after. Keep track of rounds mentally (usually 3-5 rounds is good). Be playful and competitive!`;
      }

      if (input.action === "respond") {
        return `MEME_WAR_CONTINUE: Your turn to fire back! Use search_giphy to find a meme that tops theirs. Be creative with your search terms. Comment on their meme before showing yours. Keep the energy fun and competitive!`;
      }

      if (input.action === "end") {
        session.pending_action = null;
        markPendingSave();
        const winnerText =
          input.winner === "user"
            ? "The user crushed it! Declare them the winner graciously. 🏆"
            : input.winner === "ai"
            ? "You won! But be humble about it. Maybe they'll get you next time. 😎"
            : "It's a tie! Both brought the heat. Call it a draw and suggest a rematch. 🤝";
        return `MEME_WAR_ENDED: ${winnerText} Suggest they can start another war anytime with "let's have a meme war"`;
      }

      return "MEME_WAR_ERROR: Invalid action. Use 'start', 'respond', or 'end'.";
    }
  );

  const submitFeedbackTool = ai.defineTool(
    {
      name: "submit_feedback",
      description:
        "Submit user feedback about their experience. Use this when users want to give feedback, rate the experience, or suggest improvements. This is OPTIONAL - never pressure users to give feedback.",
      inputSchema: z.object({
        rating: z
          .number()
          .min(1)
          .max(5)
          .describe("Rating from 1-5 stars (1=poor, 5=excellent)"),
        feedback: z
          .string()
          .optional()
          .describe("General feedback or what they liked"),
        suggestions: z
          .string()
          .optional()
          .describe("Suggestions for improvement"),
        category: z
          .enum(["onboarding", "mentoring", "ui", "general"])
          .optional()
          .describe("Category of feedback"),
      }),
      outputSchema: z.string(),
    },
    async (input) => {
      console.log("🛠️ Tool executing: submit_feedback", input);

      try {
        const feedbackDoc = new Feedback({
          session_id: session.session_id,
          email: session.applicant_data?.email,
          name: session.applicant_data?.name,
          rating: input.rating,
          feedback: input.feedback,
          suggestions: input.suggestions,
          category: input.category || "general",
          onboarding_state: session.state,
        });

        await feedbackDoc.save();
        console.log("✅ Feedback saved successfully");

        const starEmoji = "⭐".repeat(input.rating);
        return `FEEDBACK_SAVED: Thank you for the ${starEmoji} rating!${
          input.feedback ? " Your feedback has been recorded." : ""
        }${
          input.suggestions ? " Your suggestions will help us improve!" : ""
        } We really appreciate you taking the time to share your thoughts.`;
      } catch (error) {
        console.error("Failed to save feedback:", error);
        return "ERROR: Failed to save feedback. Please try again later.";
      }
    }
  );

  const searchGiphyTool = ai.defineTool(
    {
      name: "search_giphy",
      description:
        "REQUIRED: Search Giphy for a fun GIF/meme. Use this at key moments: welcome, achievements, struggles, completion, jokes. Call with {query: 'search term'}. Returns markdown image to include in your response.",
      inputSchema: z.object({
        query: z
          .string()
          .describe(
            "Search term like 'celebration', 'this is fine', 'coding', 'excited'"
          ),
      }),
      outputSchema: z.string(),
    },
    async (input) => {
      try {
        const apiKey = process.env.GIPHY_API_KEY;
        if (!apiKey) {
          console.error("GIPHY_API_KEY not set");
          return "Giphy unavailable. Use a fallback meme from your instructions.";
        }

        const response = await fetch(
          `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(
            input.query
          )}&limit=3&rating=pg`
        );

        if (!response.ok) {
          return "Giphy search failed. Use a fallback meme.";
        }

        const data = await response.json();
        if (data.data && data.data.length > 0) {
          // Pick a random one from top 3 for variety
          const randomIndex = Math.floor(
            Math.random() * Math.min(data.data.length, 3)
          );
          const gif = data.data[randomIndex];
          // Use fixed_height or original - these are most reliably available
          const url =
            gif.images.fixed_height?.url ||
            gif.images.original?.url ||
            gif.images.downsized?.url;
          if (!url) {
            return "No usable GIF found. Use a fallback meme.";
          }
          console.log("Giphy found:", gif.title, url);
          return `Found a perfect GIF! Include this in your response:\n![${
            gif.title || input.query
          }](${url})`;
        }
        return "No GIF found. Use a fallback meme from your instructions.";
      } catch (error) {
        console.error("Giphy search error:", error);
        return "Giphy error. Use a fallback meme.";
      }
    }
  );

  const searchWebTool = ai.defineTool(
    {
      name: "analyze_url",
      description:
        "Fetch and analyze ANY URL - GitHub profiles, portfolios, blogs, documentation, articles, tutorials, or any web page. Uses Jina AI Reader for clean content extraction. LinkedIn will fail due to their restrictions.",
      inputSchema: z.object({
        url: z.string().describe("The URL to fetch and analyze"),
        context: z
          .string()
          .optional()
          .describe(
            "Optional context about why you're analyzing this URL (e.g., 'portfolio review', 'github profile', 'learning resource', 'project demo')"
          ),
      }),
      outputSchema: z.string(),
    },
    async (input) => {
      console.log("🛠️ Tool executing: analyze_url", input.url);

      try {
        // Normalize URL - handle usernames, partial URLs, etc.
        let url = input.url.trim();

        // Remove @ prefix if present
        url = url.replace(/^@/, "");

        // Detect if it's just a GitHub username (no dots, no slashes, looks like username)
        const isLikelyGitHubUsername =
          /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(url) &&
          !url.includes(".");

        if (isLikelyGitHubUsername) {
          // Assume it's a GitHub username
          url = `https://github.com/${url}`;
          console.log("Normalized GitHub username to:", url);
        } else if (url.includes("github.com") && !url.startsWith("http")) {
          url = `https://${url}`;
        } else if (url.includes("linkedin.com") && !url.startsWith("http")) {
          url = `https://${url}`;
        } else if (!url.startsWith("http://") && !url.startsWith("https://")) {
          // Add https:// for anything that looks like a domain
          if (url.includes(".")) {
            url = `https://${url}`;
          } else {
            // If it doesn't look like a URL at all, try as GitHub username
            url = `https://github.com/${url}`;
            console.log("Assumed GitHub username:", url);
          }
        }

        // Skip LinkedIn - it always blocks
        if (url.includes("linkedin.com")) {
          return "LinkedIn profiles cannot be fetched (they block automated access). Just save the URL directly and let them know you couldn't preview it.";
        }

        // Fetch using Jina AI Reader API
        const jinaUrl = `https://r.jina.ai/${url}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        let response: Response;
        try {
          response = await fetch(jinaUrl, {
            headers: {
              Accept: "application/json",
            },
            signal: controller.signal,
          });
        } catch (fetchError) {
          clearTimeout(timeoutId);
          throw fetchError;
        }

        clearTimeout(timeoutId);

        if (!response.ok) {
          return `Could not fetch the page via Jina (HTTP ${response.status}). The URL might be private, require login, or not exist. Just save it and mention you couldn't preview it.`;
        }

        let markdown: string;
        try {
          const data = (await response.json()) as { content?: string };
          markdown = data.content || "";

          if (!markdown) {
            return `Could not extract content from the page. It might be private or blocked. You can still save the URL and let the user know.`;
          }
        } catch (parseError) {
          console.error("Error parsing Jina response:", parseError);
          return `Could not read the page content. The page might be in an unsupported format. You can still save the URL and let the user know.`;
        }

        // Detect page type
        const isGitHub = url.includes("github.com");
        const isDevTo = url.includes("dev.to");
        const isMedium =
          url.includes("medium.com") || url.includes(".medium.com");
        const isStackOverflow = url.includes("stackoverflow.com");
        const isYouTube =
          url.includes("youtube.com") || url.includes("youtu.be");
        const isTwitterX = url.includes("twitter.com") || url.includes("x.com");
        const isNpm = url.includes("npmjs.com");
        const isDocs =
          url.includes("docs.") ||
          url.includes("/docs") ||
          url.includes("documentation");
        const isBlog =
          url.includes("blog") ||
          url.includes("/posts") ||
          url.includes("/articles");
        const isCodepen = url.includes("codepen.io");
        const isReplit = url.includes("replit.com") || url.includes("repl.it");
        const isVercel = url.includes("vercel.app");
        const isNetlify = url.includes("netlify.app");

        // Extract title from markdown (usually first heading)
        const titleMatch =
          markdown.match(/^#\s+(.+)$/m) || markdown.match(/title:\s*(.+)/i);
        const title = titleMatch ? titleMatch[1].trim() : "Unknown";

        // Extract description if available
        const descMatch =
          markdown.match(/description:\s*(.+)/i) ||
          markdown.match(/summary:\s*(.+)/i);
        const description = descMatch ? descMatch[1].trim() : "";

        // Truncate content AGGRESSIVELY - max 3000 chars to avoid AI timeout
        const maxLength = 3000;
        const truncatedContent =
          markdown.length > maxLength
            ? markdown.slice(0, maxLength) + "..."
            : markdown;

        // Determine page type and generate focused summary
        let pageType = "Web Page";
        let summary = "";

        if (isGitHub) {
          pageType =
            url.includes("/blob/") || url.includes("/tree/")
              ? "GitHub Repository"
              : "GitHub Profile";

          // Extract GitHub-specific info from markdown
          const repoMatch = markdown.match(/(\d+)\s*repositories?/i);
          const followerMatch = markdown.match(/(\d+)\s*followers?/i);
          const followingMatch = markdown.match(/(\d+)\s*following/i);
          const starMatch = markdown.match(/(\d+)\s*stars?/i);
          const bioMatch = markdown.match(/bio[:\s]+([^\n]+)/i);

          const repoCount = repoMatch ? repoMatch[1] : "";
          const followers = followerMatch ? followerMatch[1] : "";
          const following = followingMatch ? followingMatch[1] : "";
          const stars = starMatch ? starMatch[1] : "";
          const bio = bioMatch ? bioMatch[1].trim() : "";

          summary = `GitHub Stats: ${repoCount ? `${repoCount} repos` : ""}${
            followers ? `, ${followers} followers` : ""
          }${following ? `, ${following} following` : ""}${
            stars ? `, ${stars} stars` : ""
          }${bio ? `\nBio: ${bio}` : ""}`;
        } else if (isDevTo || isMedium || isBlog) {
          pageType = "Blog/Article";
        } else if (isCodepen || isReplit) {
          pageType = "Code Playground";
        } else if (isVercel || isNetlify) {
          pageType = "Deployed Project";
        } else if (isDocs) {
          pageType = "Documentation";
        }

        return `=== ${pageType}: ${title} ===
        URL: ${url}
        ${description ? `Description: ${description}` : ""}
        ${summary ? `\n${summary}` : ""}
        
        Key content (excerpt):
        ${truncatedContent.slice(0, 1500)}
        
        Give brief, encouraging feedback based on what you see. Be specific but concise!`;
      } catch (error: unknown) {
        console.error("URL analysis error:", error);
        const errorMessage =
          error instanceof Error && error.name === "AbortError"
            ? "Request timed out (site took too long to respond)"
            : "Could not access the URL";
        return `${errorMessage}. Possible reasons: site is down, requires authentication, or blocks automated access. You can still save the URL and let the user know you couldn't preview it.`;
      }
    }
  );
  const transitionToFreeChatTool = ai.defineTool(
    {
      name: "transition_to_free_chat",
      description: `Transition the user from COMPLETED state to FREE_CHAT state. Use this tool:
1. AFTER the user gives feedback on the onboarding experience
2. When the user ignores the feedback request and wants to do something else
3. When the user wants to chat freely, have meme wars, or explore
4. When you detect the user is done with the "just completed" phase

This allows free-flowing conversation without being stuck in "COMPLETED" state.`,
      inputSchema: z.object({
        reason: z
          .string()
          .optional()
          .describe("Why transitioning to free chat (for logging)"),
      }),
      outputSchema: z.string(),
    },
    async (input) => {
      console.log(
        "🛠️ Tool executing: transition_to_free_chat",
        input.reason || "no reason given"
      );

      if (session.state !== "COMPLETED" && session.state !== "FREE_CHAT") {
        return "ERROR: Can only transition to FREE_CHAT from COMPLETED state. User must complete onboarding first.";
      }

      if (session.state === "FREE_CHAT") {
        return "Already in FREE_CHAT state. Continue chatting freely!";
      }

      // Clear any pending states that might interfere
      session.pending_verification = undefined;
      session.pending_recovery = undefined;
      session.pending_action = null;

      session.state = "FREE_CHAT" as OnboardingState;
      markPendingSave();

      console.log("✅ Transitioned to FREE_CHAT state");
      return `STATE_CHANGED: Transitioned to FREE_CHAT mode. The user is now in free interaction mode where they can:
- Chat freely about anything
- Have meme wars
- Ask coding questions
- Get mentorship advice (based on their application status)
- Check their application status
- Update their profile

Don't force any specific flow - just be natural and helpful!`;
    }
  );
  return [
    startMemeWarTool,
    submitFeedbackTool,
    searchGiphyTool,
    searchWebTool,
    transitionToFreeChatTool,
  ];
}
