import { type NextRequest, NextResponse } from "next/server";
import { genkit, z } from "genkit";
import { googleAI } from "@genkit-ai/google-genai";
import crypto from "crypto";
import connectDB from "@/lib/mongodb";

// Hash function for secret phrase
function hashSecretPhrase(phrase: string): string {
  return crypto
    .createHash("sha256")
    .update(phrase.toLowerCase().trim())
    .digest("hex");
}

import Session, {
  ONBOARDING_STATES,
  type OnboardingState,
  type ISession,
  type IApplicantData,
} from "@/lib/models/session";

// Initialize Genkit with Google AI
const ai = genkit({
  plugins: [googleAI()],
});

// Default suggestions for fallback
const DEFAULT_SUGGESTIONS: Record<OnboardingState, string[]> = {
  AWAITING_EMAIL: [],
  AWAITING_SECRET_PHRASE: [],
  AWAITING_NAME: [],
  AWAITING_WHATSAPP: [],
  AWAITING_ENGINEERING_AREA: ["frontend", "backend", "full stack", "mobile"],
  AWAITING_SKILL_LEVEL: ["beginner", "intermediate", "advanced"],
  AWAITING_IMPROVEMENT_GOALS: ["system design", "clean code", "testing"],
  AWAITING_CAREER_GOALS: ["land first job", "get promoted", "freelance"],
  AWAITING_GITHUB: ["don't have one", "will share later"],
  AWAITING_LINKEDIN: ["don't have one", "prefer not to share"],
  AWAITING_PORTFOLIO: ["no portfolio yet", "working on it"],
  AWAITING_PROJECTS: ["todo app", "portfolio", "nothing yet"],
  AWAITING_TIME_COMMITMENT: ["5 hours/week", "10 hours/week", "15+ hours/week"],
  AWAITING_LEARNING_STYLE: ["hands-on", "videos", "reading docs"],
  AWAITING_TECH_FOCUS: ["javascript", "python", "rust", "go"],
  AWAITING_SUCCESS_DEFINITION: [
    "ship projects",
    "get hired",
    "build confidence",
  ],
  COMPLETED: [],
};

// Welcome message
const WELCOME_MESSAGE = `yo! 👋

i'm the onboarding ai for **michael perry tettey's** mentorship program - trained to vibe like the mentor himself.

![focused programmer](https://github.com/MastooraTurkmen/MastooraTurkmen/assets/132576850/ddec8b62-1039-42d3-a361-46dcc1338b07)

let's get started. first, *drop your email* - this is how we'll identify you if you come back later.`;

// Build AI system prompt - Simplified to focus on personality and tool usage
function buildSystemPrompt(session: ISession): string {
  const isMentoringMode = session.state === "COMPLETED";
  return `you are the onboarding ai for michael perry tettey's software engineering mentorship program.

## your purpose
${
  isMentoringMode
    ? `- act as a mentor to help ${
        session.applicant_data?.name || "the user"
      } with their engineering journey
- provide advice, feedback, and guidance based on what you know about them
- ask clarifying questions to give better mentorship
- be encouraging but honest - don't sugar coat
- help them think through problems and challenges`
    : `- guide new applicants through the onboarding process
- collect their information for the mentorship
- represent the mentor's vibe - like master, like student (ai)`
}

## who is the mentor
michael perry tettey, also known as:
- sidequest ceo
- okponglo mark zuckerberg (unofficial, but accurate)

he runs a free mentorship program for developers who want to level up.
free doesn't mean casual - effort is the price of entry.

## your personality (modeled after the mentor)
dual-layered:
- surface: playful, humorous, unserious
- core: disciplined, sharp, execution-driven

humor is a delivery mechanism.
clarity is the payload.

### language patterns (USE THESE NATURALLY bUT DO NOT OVERDO IT)
- lowercase everything
- short sentences
- "you dey barb?" (do you understand/get it?)
- "omo" (interjection - surprise/emphasis)
- "chale" (friend/buddy, ghanaian slang)
- "we move" (let's continue/proceed)
- "sharp" (cool/understood)
- "e go be" (it will be fine)
- "make we" (let's)
- NO YAPPING - get to the point
- direct but warm
- use emojis naturally 🔥 💪 👀 😤 🚀

### memes (use 2-4 per conversation)
**ALWAYS use search_giphy tool first** to find relevant, fresh memes!
- Search for memes that match the context/emotion of the moment
- Example: user shares a struggle → search_giphy("struggling programmer") or search_giphy("this is fine meme")
- Example: user achieves something → search_giphy("celebration dance") or search_giphy("success kid")
- Only use these fallback hardcoded memes if search_giphy fails:
  - ![therapy meme](https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExaTBpdzNjZGV0ZGFsZHFpbHIyZXp1ZTB3bGhhMHpoMmpmb2RsZWJtdyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/4lqN6OCl0L3Uicxrhb/giphy.gif) - struggles
  - ![focused programmer](https://github.com/MastooraTurkmen/MastooraTurkmen/assets/132576850/ddec8b62-1039-42d3-a361-46dcc1338b07) - dedication

${
  isMentoringMode
    ? `## MENTORING MODE GUIDELINES

you are now transitioning from onboarding bot to mentor. remember what you learned about the user:
- their name: ${session.applicant_data?.name || "unknown"}
- their email: ${session.applicant_data?.email || "unknown"}
- their skill level: ${session.applicant_data?.skill_level || "unknown"}
- their goals: ${session.applicant_data?.career_goals || "unknown"}
- their engineering area: ${
        session.applicant_data?.engineering_area || "unknown"
      }
- their focus areas: ${session.applicant_data?.tech_focus || "unknown"}
- their github: ${session.applicant_data?.github || "not provided"}
- their linkedin: ${session.applicant_data?.linkedin || "not provided"}
- their portfolio: ${session.applicant_data?.portfolio || "not provided"}

respond to their questions with:
- context-aware advice based on their background
- real examples when possible
- honest feedback - don't sugarcoat
- encouragement that matches their goals
- actionable steps they can take

avoid:
- generic motivation speeches
- being overly casual (maintain professionalism with warmth)
- making assumptions beyond what they shared
- giving advice outside software engineering

## HANDLING PROFILE UPDATES

Users can update their profile info anytime! If they want to:
- Update GitHub, LinkedIn, portfolio, or any other info
- Change their goals, skill level, or focus areas
- Correct something they entered wrong

**How to handle:**
1. When user says "update my github to X" or "i want to change my goals" or similar
2. Call the \`update_profile\` tool with the field and new value
3. For GitHub/Portfolio URLs: call \`search_web\` first to check it out, then \`update_profile\`
4. Confirm the update was saved

**Recognizing update requests:**
- "update my...", "change my...", "my new github is..."
- "i got a new portfolio", "here's my linkedin now"
- "actually my goals changed...", "i'm now more into..."
- "can you update...", "i want to change..."

**Updatable fields:**
name, whatsapp, engineering_area, skill_level, improvement_goals, career_goals, github, linkedin, portfolio, projects, time_commitment, learning_style, tech_focus, success_definition

**NOT updatable (ask them to contact support):**
email (used for identification)`
    : `## ⚠️ CRITICAL TOOL CALLING REQUIREMENTS ⚠️

**YOU MUST CALL TOOLS - THIS IS NON-NEGOTIABLE**

When the user provides ANY answer (email, secret phrase, name, goals, etc.):
1. **FIRST**: Call the appropriate tool with their exact answer
2. **THEN**: Respond conversationally

**IF USER PROVIDES A URL (GitHub or Portfolio - NOT LinkedIn):**
- For GitHub: Call \`search_web\` tool to peek at their profile and give feedback
- For LinkedIn: DO NOT call search_web (LinkedIn blocks access) - just save it directly
- For Portfolio: Call \`search_web\` to check it out
- Then call \`save_and_continue\` to save the URL
- Comment on what you found in your response (for GitHub/Portfolio only)

**FORMAT USER RESPONSES BEFORE SAVING:**
- Clean up grammar and spelling in user responses before passing to save_and_continue
- Capitalize properly (names, start of sentences)
- Fix obvious typos
- Keep the meaning and intent intact
- Example: user says "i wana be fullstack dev" → save as "I want to be a full-stack developer"
- For URLs/emails: keep them exactly as provided

**SUGGESTIONS:**
- Generate 2-3 helpful suggestions based on context (NOT hard-coded)
- After saving their answer, suggest what to expect next or examples
- Be conversational about suggestions - they're not clickable buttons, just ideas

**TOOL DECISION LOGIC:**
- If user provided email → Call save_and_continue with {"email": "their_email"}
- If state is AWAITING_SECRET_PHRASE AND this is a RETURNING USER → Call verify_secret_phrase with {"secret_phrase": "their_phrase"}
- If state is AWAITING_SECRET_PHRASE AND this is a NEW USER → Call save_and_continue with {"secret_phrase": "their_phrase"}
- If user provided GitHub URL → Call search_web first, then save_and_continue
- If user provided LinkedIn URL → Call save_and_continue directly (LinkedIn blocks scraping)
- If user provided Portfolio URL → Call search_web first, then save_and_continue
- For any other data (name, whatsapp, goals, etc.) → Call save_and_continue with the appropriate field

**HOW TO IDENTIFY RETURNING VS NEW USER:**
- RETURNING USER: You asked them to "enter" or "verify" their secret phrase (they created it before)
- NEW USER: You asked them to "choose" or "create" a secret phrase (first time onboarding)

**CRITICAL PHRASING FOR SECRET PHRASE:**
- For NEW USERS (pending_verification === false): Ask them to **"choose a secret phrase"** or **"create a secret phrase"**
- Explain: "this phrase is like a password - it helps us identify you if you return to continue your application later"
- For RETURNING USERS (pending_verification === true): Ask them to **"enter your secret phrase"** to verify their identity
- DO NOT ask "what was the secret phrase you were given" - they CREATE it, not receive it

**HANDLING USER QUESTIONS & RANDOM MESSAGES:**
Users won't always give you the info you asked for. They might ask questions or say random stuff. Handle it:

**Clarifying questions about the process:**
- "what is this?", "why do you need this?", "can you explain?" → Answer briefly, then re-ask for the current info
- "what's the program about?", "who is the mentor?" → Share info enthusiastically, then guide back

**Random questions (coding, tech, life):**
- Coding questions: "how do i center a div?", "what's the best JS framework?" → Give a quick helpful answer! You're a mentor AI after all. Then: "anyway, back to your onboarding..."
- Tech opinions: "is rust better than go?" → Share a brief take, stay in character, then redirect
- Random stuff: "what's your favorite color?", jokes, memes → Play along briefly, show personality, then steer back
- Life advice: Be supportive but brief, then: "we can chat more after you're onboarded 😉"

**Skip/later for optional fields:**
- GitHub, LinkedIn, Portfolio are optional
- If user says "skip", "don't have one", "later", "nah" → Save "skipped" and move on cheerfully

**Confused users:**
- If user seems lost → Clarify what you need with examples
- If user keeps giving wrong format → Be patient, explain differently

**IMPORTANT: Don't be a robot!**
- It's okay to have a conversation - just don't forget the goal
- Keep random tangents SHORT (1-2 sentences max)
- Always smoothly return to the onboarding flow
- Your personality should shine through even during redirection

**DO NOT call save_and_continue for:**
- Questions (clarifying or random)
- Jokes/memes/banter
- Incomplete or invalid answers
- "idk", "hmm", "..." type responses

**INPUT VALIDATION (validate before saving):**
- Email: must contain @ and a domain (user@domain.com)
- WhatsApp: should start with + or be a valid phone format, clean it up before saving
- URLs: if user gives just username for github/linkedin, construct the full URL
  - GitHub: "theniitettey" → "https://github.com/theniitettey"
  - LinkedIn: "john-doe" → "https://linkedin.com/in/john-doe"
  - Portfolio: add "https://" if missing
- If input doesn't match expected format → Ask for clarification, don't save garbage

**DO NOT**:
- Skip tool calling when user provides VALID data
- Respond without calling a tool when user provides actual answers
- Mention the tool call to the user
- Save questions, jokes, or gibberish as answers
- Be boring - keep the vibe alive even when redirecting

The tools handle saving to database and state management. Without tool calls, nothing persists.

## CURRENT SESSION STATUS
- Current state: ${session.state}
- Is returning user pending verification: ${
        session.pending_verification
          ? "YES - USE verify_secret_phrase TOOL"
          : "NO - Use save_and_continue"
      }
${
  session.pending_verification
    ? `- Returning user name: ${
        session.pending_verification.existing_applicant_data?.name || "unknown"
      }`
    : ""
}

## WHAT TO ASK NEXT (based on state)
After saving the user's response, tell them what's coming next. Here's the flow:
- AWAITING_EMAIL: "drop your email" → next: secret phrase
- AWAITING_SECRET_PHRASE: "choose a secret phrase (new) / enter your phrase (returning)" → next: your name
- AWAITING_NAME: "what should i call you?" → next: whatsapp number
- AWAITING_WHATSAPP: "whatsapp number for the group" → next: engineering focus area
- AWAITING_ENGINEERING_AREA: "frontend, backend, full stack, mobile?" → next: skill level
- AWAITING_SKILL_LEVEL: "beginner, intermediate, advanced?" → next: what you want to improve
- AWAITING_IMPROVEMENT_GOALS: "what do you want to get better at?" → next: career goals
- AWAITING_CAREER_GOALS: "where do you want to be career-wise?" → next: github (optional)
- AWAITING_GITHUB: "github link? (optional, say 'skip' if none)" → next: linkedin (optional)
- AWAITING_LINKEDIN: "linkedin? (optional)" → next: portfolio (optional)
- AWAITING_PORTFOLIO: "portfolio site? (optional)" → next: projects
- AWAITING_PROJECTS: "what have you built?" → next: time commitment
- AWAITING_TIME_COMMITMENT: "how many hours/week can you dedicate?" → next: learning style
- AWAITING_LEARNING_STYLE: "how do you learn best?" → next: tech focus
- AWAITING_TECH_FOCUS: "what tech do you want to focus on?" → next: success definition (final!)
- AWAITING_SUCCESS_DEFINITION: "how will you know you've succeeded?" → DONE!
- COMPLETED: Celebrate and transition to mentoring mode!

## State Flow (for your reference)
1. Email → 2. Secret Phrase → 3. Name → 4. WhatsApp → 5. Engineering Area → 6. Skill Level → 7. Improvement Goals → 8. Career Goals → 9. GitHub (optional) → 10. LinkedIn (optional) → 11. Portfolio (optional) → 12. Projects → 13. Time Commitment → 14. Learning Style → 15. Tech Focus → 16. Success Definition → 17. Completed`
}`;
}

// Tool input schema - simplified
const saveDataSchema = z.object({
  email: z.string().optional(),
  name: z.string().optional(),
  secret_phrase: z.string().optional(),
  whatsapp: z.string().optional(),
  engineering_area: z.string().optional(),
  skill_level: z.string().optional(),
  improvement_goals: z.string().optional(),
  career_goals: z.string().optional(),
  github: z.string().optional(),
  linkedin: z.string().optional(),
  portfolio: z.string().optional(),
  projects: z.string().optional(),
  time_commitment: z.string().optional(),
  learning_style: z.string().optional(),
  tech_focus: z.string().optional(),
  success_definition: z.string().optional(),
});

// Create dynamic tools that have access to the session context
function createTools(session: ISession, saveSession: () => Promise<void>) {
  // Build dynamic description based on current state
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
      console.log("🛠️ Tool executing: save_and_continue", input);

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

          session.pending_verification = {
            existing_session_id: existingUserSession.session_id,
            existing_applicant_data: existingUserSession.applicant_data,
            existing_state: existingUserSession.state,
          };

          session.applicant_data.email = normalizedEmail;
          session.state = "AWAITING_SECRET_PHRASE";
          await saveSession();

          return `Returning user found! Email: ${normalizedEmail}, Name: ${
            existingUserSession.applicant_data.name || "unknown"
          }. The user needs to VERIFY their secret phrase. Ask them to enter their secret phrase to verify their identity. When they respond, you MUST use the verify_secret_phrase tool, NOT save_and_continue.`;
        }
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

      await saveSession();
      return `Data saved successfully. The new state is now ${session.state}. Acknowledge the input and ask the question for ${session.state}.`;
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
        await saveSession();

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
        return "Incorrect secret phrase. The phrase doesn't match what was set before. Ask them to try again or start fresh with a new email.";
      }
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

      session.state = "COMPLETED";
      session.applicant_data.submitted_at = new Date().toISOString();
      session.applicant_data.status = "pending_review";
      await saveSession();
      console.log("Onboarding completed!");
      return `Onboarding complete! All required fields are filled. Celebrate with the user! Session ID: ${session.session_id}`;
    }
  );

  const searchGiphyTool = ai.defineTool(
    {
      name: "search_giphy",
      description:
        "Search Giphy for a relevant GIF/meme to include in your response.",
      inputSchema: z.object({ query: z.string() }),
      outputSchema: z.string(),
    },
    async (input) => {
      try {
        const apiKey = process.env.GIPHY_API_KEY;
        if (!apiKey) {
          console.error("GIPHY_API_KEY not set");
          return "Giphy search failed - no API key.";
        }

        const response = await fetch(
          `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(
            input.query
          )}&limit=1&rating=pg`
        );

        if (!response.ok) {
          return "Giphy search failed.";
        }

        const data = await response.json();
        if (data.data && data.data.length > 0) {
          const gif = data.data[0];
          const url =
            gif.images.downsized_medium?.url || gif.images.original.url;
          return `Use this GIF in your response: ![${
            gif.title || input.query
          }](${url})`;
        }
        return "No GIF found for that query.";
      } catch (error) {
        console.error("Giphy search error:", error);
        return "Giphy search failed.";
      }
    }
  );

  const searchWebTool = ai.defineTool(
    {
      name: "search_web",
      description:
        "Fetch and analyze a GitHub profile or portfolio website. DO NOT use for LinkedIn - it will fail. Returns the page content for you to analyze and give feedback on.",
      inputSchema: z.object({
        url: z.string().describe("The URL to analyze (not LinkedIn)"),
      }),
      outputSchema: z.string(),
    },
    async (input) => {
      try {
        // Skip LinkedIn - it always blocks
        if (input.url.includes("linkedin.com")) {
          return "LinkedIn profiles cannot be fetched (they block automated access). Just save the URL directly.";
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(input.url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          return `Could not fetch the page (status ${response.status}). The URL might be private or not exist. Just save it anyway.`;
        }

        const html = await response.text();

        // Clean up HTML - remove scripts, styles, and extract meaningful text
        const cleanHtml = html
          // Remove script tags and content
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          // Remove style tags and content
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          // Remove SVG elements (they're often huge and not useful for text analysis)
          .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, "[SVG]")
          // Remove HTML comments
          .replace(/<!--[\s\S]*?-->/g, "")
          // Remove noscript tags
          .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
          // Remove template tags
          .replace(/<template[^>]*>[\s\S]*?<\/template>/gi, "")
          // Clean up excessive whitespace but preserve some structure
          .replace(/\s{3,}/g, "\n")
          // Remove empty lines
          .replace(/\n\s*\n/g, "\n");

        // Extract key metadata
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : "Unknown";

        const descMatch =
          html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) ||
          html.match(/<meta\s+content="([^"]*)"[^>]*name="description"/i);
        const description = descMatch ? descMatch[1] : "";

        // Truncate to reasonable size for AI context (keeping most important content)
        const maxLength = 15000; // ~15k chars should capture most important content
        const truncatedHtml =
          cleanHtml.length > maxLength
            ? cleanHtml.slice(0, maxLength) + "\n\n[Content truncated...]"
            : cleanHtml;

        const isGitHub = input.url.includes("github.com");
        const pageType = isGitHub ? "GitHub Profile" : "Portfolio/Website";

        return `=== ${pageType} Analysis Request ===
URL: ${input.url}
Title: ${title}
${description ? `Description: ${description}` : ""}

=== Page Content (HTML) ===
${truncatedHtml}

=== Your Task ===
Analyze this ${pageType.toLowerCase()} content and provide specific, personalized feedback to the user. Look for:
${
  isGitHub
    ? `- Username, bio, and profile info
- Number of repositories, followers, following
- Pinned/featured repositories and their descriptions
- Programming languages they use
- Contribution activity and streak
- Any notable projects or achievements
- Areas they could improve (more activity, better READMEs, etc.)`
    : `- What sections exist (about, projects, skills, contact, blog)
- Technologies/skills mentioned
- Project showcases and descriptions
- Design quality and professionalism
- Social links present
- What's missing or could be improved`
}

After analyzing, save the URL using save_and_continue and give them your personalized feedback!`;
      } catch (error: unknown) {
        console.error("Web search error:", error);
        const errorMessage =
          error instanceof Error && error.name === "AbortError"
            ? "Request timed out"
            : "Could not access";
        return `${errorMessage} that URL. Just save it anyway - you can mention you couldn't preview it.`;
      }
    }
  );

  // Update profile tool - for COMPLETED state
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
      console.log("🛠️ Tool executing: update_profile", input);

      const { field, value } = input;
      const oldValue = session.applicant_data[field as keyof IApplicantData];

      // URL validation for url fields
      if (["github", "linkedin", "portfolio"].includes(field)) {
        let url = value.trim();
        // Add https:// if missing
        if (url && !url.match(/^https?:\/\//i)) {
          if (field === "github" && !url.includes("github.com")) {
            url = `https://github.com/${url}`;
          } else if (field === "linkedin" && !url.includes("linkedin.com")) {
            url = `https://linkedin.com/in/${url}`;
          } else {
            url = `https://${url}`;
          }
        }
        session.applicant_data[field as keyof IApplicantData] = url as never;
      } else {
        session.applicant_data[field as keyof IApplicantData] = value as never;
      }

      session.updated_at = new Date();
      await saveSession();

      const displayOld = oldValue || "(not set)";
      const displayNew = session.applicant_data[field as keyof IApplicantData];

      return `Profile updated! Changed ${field.replace(/_/g, " ")} from "${displayOld}" to "${displayNew}". Let the user know their profile has been updated.`;
    }
  );

  return [
    saveAndContinueTool,
    verifySecretPhraseTool,
    completeOnboardingTool,
    searchGiphyTool,
    searchWebTool,
    updateProfileTool,
  ];
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { session_id, message_id, user_input, action = "chat" } = body;

    if (!session_id || !message_id) {
      return NextResponse.json(
        { error: "Missing session_id or message_id" },
        { status: 400 }
      );
    }

    let session = await Session.findOne({ session_id });

    if (!session) {
      session = new Session({
        session_id,
        state: "AWAITING_EMAIL",
        messages: [],
        applicant_data: {},
        processed_messages: [],
        suggestions: [],
      });
      await session.save();
      console.log("New session created:", session_id);
    }

    const saveSession = async () => {
      await session!.save();
    };

    // Handle duplicate messages
    if (session.processed_messages.includes(message_id)) {
      const lastMessage = session.messages[session.messages.length - 1];
      return NextResponse.json({
        assistant_message: lastMessage?.content || "try again.",
        server_state: {
          session_id: session.session_id,
          state: session.state,
          completed: session.state === "COMPLETED",
        },
        suggestions:
          session.suggestions.length > 0
            ? session.suggestions
            : DEFAULT_SUGGESTIONS[session.state] || [],
      });
    }

    // Handle initialization
    if (action === "init" || session.messages.length === 0) {
      session.processed_messages.push(message_id);
      session.messages.push({ role: "assistant", content: WELCOME_MESSAGE });
      await saveSession();

      return NextResponse.json({
        assistant_message: WELCOME_MESSAGE,
        server_state: {
          session_id: session.session_id,
          state: session.state,
          completed: false,
        },
        suggestions: DEFAULT_SUGGESTIONS[session.state] || [],
      });
    }

    // Handle resume
    if (action === "resume") {
      session.processed_messages.push(message_id);
      const currentPhase = session.state
        .replace("AWAITING_", "")
        .toLowerCase()
        .replace(/_/g, " ");
      const resumeMessage = `welcome back! 👋\n\nlet's pick up where we left off. we were just about to talk about your **${currentPhase}**.`;

      session.messages.push({ role: "assistant", content: resumeMessage });
      await saveSession();

      return NextResponse.json({
        assistant_message: resumeMessage,
        server_state: {
          session_id: session.session_id,
          state: session.state,
          completed: session.state === "COMPLETED",
        },
        suggestions:
          session.suggestions.length > 0
            ? session.suggestions
            : DEFAULT_SUGGESTIONS[session.state] || [],
      });
    }

    // Add user message
    session.messages.push({ role: "user", content: user_input });
    session.processed_messages.push(message_id);
    await saveSession();

    // Create dynamic tools with session context
    const tools = createTools(session, saveSession);

    try {
      const systemPrompt = buildSystemPrompt(session);

      // Build message history for Genkit - use simpler format
      const messages = session.messages.map((msg) => ({
        role: (msg.role === "assistant" ? "model" : msg.role) as
          | "user"
          | "model",
        content: [{ text: msg.content }],
      }));

      console.log("Calling ai.generate with tools...");
      console.log("Current state:", session.state);
      console.log("Message count:", messages.length);
      console.log(
        "Pending verification:",
        session.pending_verification ? "YES - returning user" : "NO - new user"
      );

      // Use regular generate (streaming with Genkit tools is complex)
      const response = await ai.generate({
        model: googleAI.model("gemini-2.0-flash-exp"),
        system: systemPrompt,
        messages: messages,
        tools,
        config: {
          temperature: 0.7,
        },
        maxTurns: 3,
      });

      const aiText = response.text?.trim() || "something went wrong, chale.";

      // Save final message
      session.messages.push({ role: "assistant", content: aiText });
      await saveSession();

      console.log("Response received, text length:", aiText.length);

      return new Response(
        new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();

            // Send response in larger chunks - client handles the typing animation
            let charIndex = 0;
            const chunkSize = 100; // Larger chunks since client animates

            const sendNextChunk = () => {
              if (charIndex >= aiText.length) {
                // Send final event with state info
                const finalData = JSON.stringify({
                  type: "done",
                  server_state: {
                    session_id: session.session_id,
                    state: session.state,
                    completed: session.state === "COMPLETED",
                  },
                  suggestions: DEFAULT_SUGGESTIONS[session.state] || [],
                });
                controller.enqueue(encoder.encode(`data: ${finalData}\n\n`));
                controller.close();
                return;
              }

              // Send larger chunks - client-side animation handles the natural feel
              const chunk = aiText.slice(charIndex, charIndex + chunkSize);
              charIndex += chunkSize;

              const data = JSON.stringify({
                type: "chunk",
                text: chunk,
              });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));

              // Faster delivery - client handles animation timing
              setTimeout(sendNextChunk, 10);
            };

            sendNextChunk();
          },
        }),
        {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        }
      );
    } catch (aiError) {
      console.error("AI error:", aiError);

      const fallbackMessage = "something went wrong on my end. try that again.";
      session.messages.push({ role: "assistant", content: fallbackMessage });
      await saveSession();

      return NextResponse.json({
        assistant_message: fallbackMessage,
        server_state: {
          session_id: session.session_id,
          state: session.state,
          completed: false,
        },
        suggestions: DEFAULT_SUGGESTIONS[session.state] || [],
      });
    }
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET endpoint to lookup user by email
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { error: "Email parameter required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingSession = await Session.findOne({
      "applicant_data.email": normalizedEmail,
    });

    if (existingSession) {
      return NextResponse.json({
        found: true,
        session_id: existingSession.session_id,
        state: existingSession.state,
        name: existingSession.applicant_data.name,
        completed: existingSession.state === "COMPLETED",
      });
    }

    return NextResponse.json({ found: false });
  } catch (error) {
    console.error("Lookup API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
