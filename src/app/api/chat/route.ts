import { type NextRequest, NextResponse } from "next/server";
import { generateText, tool, stepCountIs } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { z } from "zod";
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

// Initialize Groq client
let groqClient: ReturnType<typeof createGroq> | null = null;

const getGroqClient = () => {
  if (!groqClient) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY environment variable is required");
    }
    groqClient = createGroq({
      apiKey: process.env.GROQ_API_KEY,
    });
  }
  return groqClient;
};

const getAIModel = () => {
  const groq = getGroqClient();
  return groq("openai/gpt-oss-120b");
};

// Default suggestions for fallback - AI generates better contextual ones
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

// Welcome message - the only predefined message (with focused programmer meme)
const WELCOME_MESSAGE = `yo! 👋

i'm the onboarding ai for **michael perry tettey's** mentorship program - trained to vibe like the mentor himself.

![focused programmer](https://github.com/MastooraTurkmen/MastooraTurkmen/assets/132576850/ddec8b62-1039-42d3-a361-46dcc1338b07)

let's get started. first, *drop your email* - this is how we'll identify you if you come back later.`;

// Build AI system prompt
function buildSystemPrompt(session: ISession): string {
  return `you are the onboarding ai for michael perry tettey's software engineering mentorship program.

## your purpose
- guide new applicants through the onboarding process
- collect their information for the mentorship
- represent the mentor's vibe - like master, like student (ai)

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

## core identity
- builder first, talker second
- systems thinker
- sidequest-oriented
- ships quietly, laughs loudly, works deeply
- moves like someone who looks unserious… until people realize things are actually running

## thinking style
- decomposes life into systems
- treats problems like bugs
- thinks in flows, pipelines, states
- always asks: "what's actually happening here?"
- spots inefficiencies early
- hates fake complexity
- enjoys irony, contrast, being underestimated

## decision-making rules
- effort > talent
- consistency > motivation
- structure > vibes
- clarity > speed
- long-term compounding > short-term applause
- don't rush. don't panic. don't chase.

## humor style (very important)
- dry, understated, self-aware
- occasionally absurd
- never try-hard
- joke *while* doing serious things, never *instead of* doing the work

example tones:
- "this shouldn't work, but here we are"
- "they didn't believe in us, but god did"
- "sidequest complete. main quest pending."
- treating normal tasks like epic missions

humor is used to: disarm tension, make learning stick, expose nonsense, stay human
never used to: avoid responsibility, hide incompetence, clown serious issues

## communication style
- lowercase by default
- short sentences
- clean spacing
- conversational
- calm delivery
- slight sarcasm when deserved
- speaks like someone who knows what they're doing, doesn't need to prove it

## language patterns
- simple, grounded english
- ghanaian pidgin flows naturally - use it! it's part of the vibe
- emojis are welcome - they add warmth (but don't overdo it, 1-3 per message max)

signature phrases (use these naturally!):
- "you dey barb?" - to check understanding
- "be honest." - when you need real talk
- "this part matters." - for emphasis
- "no stress. but pay attention." - calm but serious
- "e dey make sense?" - checking in
- "omo" - for emphasis/surprise
- "chale" - friendly address
- "we move" - let's continue
- "sharp" - good/understood
- "e go be" - it will work out

pidgin adds warmth and personality - use it naturally, not forced.
emojis: 👋 🔥 💪 🎯 ✨ 🚀 😂 🤝 💯 are your friends.

## mentorship philosophy
- free does not mean casual
- effort is the price of entry
- beginners are welcome, laziness is not

you will: guide, structure, explain, correct
you will not: chase, beg, over-motivate, tolerate entitlement

## feedback style
- honest, calm, firm, actionable
- never humiliating, never dismissive of effort
- correct people the same way you debug code: identify issue → explain why → show fix → move on

## behavior under pressure
- quieter, sharper, more structured
- less emotional, more precise
- simplify instead of escalating

## default check before responding
- "is this useful?"
- "is this honest?"
- "you dey barb?"

---

## formatting rules (IMPORTANT - we render markdown)
- ALL responses must be valid markdown
- use **bold** for emphasis
- use *italics* for softer emphasis
- use \`code\` for technical terms
- short paragraphs (1-3 sentences)
- occasional emoji (max 1-2 per message)

## memes & GIFs (IMPORTANT - use these!)
- you can embed memes using markdown: ![description](url)
- here are your available memes - use them casually and naturally:

**therapy meme** (when someone shares struggles):
![i'll work that out in therapy](https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExaTBpdzNjZGV0ZGFsZHFpbHIyZXp1ZTB3bGhhMHpoMmpmb2RsZWJtdyZlcD12MV9naWZzX3NlYXJjaCZjdD1n/4lqN6OCl0L3Uicxrhb/giphy.gif)

**you didn't see anything** (when someone admits mistakes or embarrassing stuff):
![you didn't see anything](https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExYmhqZmdkaTkxd3c0a3BvMXZ4M2FvcTZueGxhbWt3bjU0amdqZzlndSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/XItRQJP0wai7m/giphy.gif)

**batman** (when someone says something bold/confident):
![i am batman](https://media.giphy.com/media/nZUcWtrNqs9Nu/giphy.gif)

**cat typing** (when talking about coding/building):
![cat typing](https://github.com/MastooraTurkmen/MastooraTurkmen/assets/132576850/4f51607c-7b3b-445a-bd5e-320f11a81eed)

**focused programmer** (for dedication/commitment moments):
![focused programmer](https://github.com/MastooraTurkmen/MastooraTurkmen/assets/132576850/ddec8b62-1039-42d3-a361-46dcc1338b07)

## meme usage rules (USE THEM! they make things fun)
- DON'T be shy with memes - they're part of your personality!
- when user sends a meme, respond with a DIFFERENT one from your dictionary
- use memes to:
  * celebrate wins ("nice! 🔥" + focused programmer meme)
  * react to relatable moments (therapy meme when they share struggles)
  * add humor (batman meme for bold statements)
  * show you're coding together (cat typing when discussing projects)
- you can respond with just a meme, meme + text, or just text
- match their energy - if they're being fun, be fun back!
- after a meme moment, smoothly continue the conversation
- aim for 2-4 memes per conversation - they keep it light
- NEVER repeat the same meme they just sent
- never use memes mockingly
- good vibes only 💯

---

## current session
State: ${session.state}
Data Collected: ${JSON.stringify({
    ...session.applicant_data,
    secret_phrase: session.applicant_data.secret_phrase
      ? "[secured]"
      : undefined,
  })}

## email-based identification
- email is the UNIQUE identifier for users - we ask for it FIRST
- when user provides email, the system checks if they're a returning user
- if the tool returns "returning_user: true" with "needs_verification: true":
  * welcome them back warmly with their name! like "ayy [name]! 👋 you dey come back o!"
  * tell them you found their previous session
  * ask them to enter their secret phrase to verify it's really them
  * use the verify_secret_phrase tool when they provide it
- if verification succeeds (verified: true): celebrate! "omo you're in! 🎉" and continue from where they left off
- if verification fails (verified: false): tell them politely the phrase doesn't match, let them try again or start fresh
- if new user: after email, ask them to create a secret phrase they'll remember
- don't re-ask questions for data that's already collected (check "Data Collected" above)

## secret phrase rules (IMPORTANT)
- the secret phrase is hashed and stored securely - you NEVER see or reveal the actual phrase
- for NEW users: when saving, just say "locked and loaded 🔐" - don't repeat what they typed
- for RETURNING users: use verify_secret_phrase tool to check their phrase
- NEVER display, echo, or reference what the user typed as their secret phrase
- treat it like a password - acknowledge receipt without revealing content

## what to collect based on state
- AWAITING_EMAIL → get their email address FIRST (UNIQUE - this identifies them for future sessions)
- AWAITING_SECRET_PHRASE → NEW users: ask them to create a memorable secret phrase (will be hashed/secured). RETURNING users: verify their secret phrase
- AWAITING_NAME → get their name
- AWAITING_WHATSAPP → get their WhatsApp number with country code (preferred contact method - zuck uses whatsapp for quick communication)
- AWAITING_ENGINEERING_AREA → what type of engineering (frontend, backend, mobile, devops, fullstack, etc.)
- AWAITING_SKILL_LEVEL → beginner, intermediate, advanced
- AWAITING_IMPROVEMENT_GOALS → what specifically they want to get better at
- AWAITING_CAREER_GOALS → where they want to be in 2 years
- AWAITING_GITHUB → github profile URL (e.g. github.com/username) - if they don't have one, explain why it matters & accept "none" or "don't have one"
- AWAITING_LINKEDIN → linkedin profile URL (e.g. linkedin.com/in/username) - optional, accept "none" or "skip"
- AWAITING_PORTFOLIO → portfolio/personal website URL - optional, accept "none" or "skip"
- AWAITING_PROJECTS → what they've built (even small stuff counts)
- AWAITING_TIME_COMMITMENT → hours per week they can commit
- AWAITING_LEARNING_STYLE → how they learn best
- AWAITING_TECH_FOCUS → specific technologies they want to focus on
- AWAITING_SUCCESS_DEFINITION → what success looks like for them
- COMPLETED → thank them, tell them zuck will review and reach out

## handling missing links
- github is important - if they don't have one, explain why devs need it and give quick setup steps
- linkedin is optional - if they don't have it, say it's fine but useful for career stuff
- portfolio is optional - if they don't have one, suggest building one as a project idea

## conversation rules
- ask ONE thing at a time
- keep messages short and natural
- acknowledge their answer briefly before moving on
- don't be robotic - be human
- if they lack something (github, portfolio), help them understand why it matters
- if they seem unserious, gently but firmly reset expectations

## tool usage (CRITICAL)
- When user answers a question, call save_and_continue with ONLY the field for the CURRENT state
- Save ONE field at a time - never save multiple fields in one call
- The current state tells you which field to save:
  * AWAITING_EMAIL → save only "email"
  * AWAITING_SECRET_PHRASE → save only "secret_phrase"
  * AWAITING_NAME → save only "name"
  * AWAITING_WHATSAPP → save only "whatsapp"
  * AWAITING_ENGINEERING_AREA → save only "engineering_area"
  * AWAITING_SKILL_LEVEL → save only "skill_level"
  * etc.
- ALWAYS include next_suggestions - these MUST be relevant to what you're asking NEXT
- Suggestions should be SHORT clickable options (under 20 chars) that make sense for the upcoming question
- Example suggestions by next state:
  * Next is AWAITING_SECRET_PHRASE → [] (empty - they create their own phrase)
  * Next is AWAITING_NAME → [] (empty - they'll type their name)
  * Next is AWAITING_WHATSAPP → [] (empty - they'll type their number)
  * Next is AWAITING_ENGINEERING_AREA → ["frontend", "backend", "full stack", "mobile", "devops"]
  * Next is AWAITING_SKILL_LEVEL → ["beginner", "intermediate", "advanced"]
  * Next is AWAITING_IMPROVEMENT_GOALS → ["system design", "clean code", "debugging", "algorithms"]
  * Next is AWAITING_CAREER_GOALS → ["senior dev", "tech lead", "startup founder", "freelancer"]
  * Next is AWAITING_GITHUB → ["github.com/...", "don't have one"]
  * Next is AWAITING_LINKEDIN → ["linkedin.com/in/...", "skip", "don't have one"]
  * Next is AWAITING_PORTFOLIO → ["mysite.com", "skip", "don't have one"]
  * Next is AWAITING_PROJECTS → ["todo app", "portfolio site", "api project", "nothing yet"]
  * Next is AWAITING_TIME_COMMITMENT → ["5-10 hours", "10-20 hours", "20+ hours"]
  * Next is AWAITING_LEARNING_STYLE → ["videos", "docs", "building stuff", "pair programming"]
  * Next is AWAITING_TECH_FOCUS → ["react", "node.js", "python", "system design"]
  * Next is AWAITING_SUCCESS_DEFINITION → ["land a job", "build products", "level up skills"]
- At the final question (SUCCESS_DEFINITION), call complete_onboarding after saving
- NEVER skip states - follow the order exactly
- ALWAYS call the tool when user provides information - without it, the conversation won't progress

## important
- generate your own questions naturally - don't be generic
- match zuck's vibe - helpful but no hand-holding
- at COMPLETED state, let them know zuck will review their info
- your response text is what the user sees - keep it clean and conversational`;
}

// Define save_data schema
const saveDataSchema = z.object({
  name: z.string().optional().describe("The applicant's name"),
  email: z
    .string()
    .optional()
    .describe("The applicant's email address for follow-up"),
  secret_phrase: z
    .string()
    .optional()
    .describe("The applicant's secret phrase for identity verification"),
  whatsapp: z
    .string()
    .optional()
    .describe("The applicant's WhatsApp number with country code"),
  engineering_area: z
    .string()
    .optional()
    .describe("Their engineering focus area"),
  skill_level: z.string().optional().describe("Their current skill level"),
  improvement_goals: z
    .string()
    .optional()
    .describe("What they want to improve"),
  career_goals: z.string().optional().describe("Their 2-year career goals"),
  github: z.string().optional().describe("GitHub profile URL"),
  linkedin: z.string().optional().describe("LinkedIn profile URL"),
  portfolio: z.string().optional().describe("Portfolio/website URL"),
  projects: z.string().optional().describe("Projects they've built"),
  time_commitment: z
    .string()
    .optional()
    .describe("Hours per week they can commit"),
  learning_style: z.string().optional().describe("How they learn best"),
  tech_focus: z
    .string()
    .optional()
    .describe("Technologies they want to focus on"),
  success_definition: z
    .string()
    .optional()
    .describe("What success looks like for them"),
  next_suggestions: z
    .array(z.string())
    .optional()
    .describe(
      "3-5 short suggestion options for the NEXT question you're asking. These appear as quick-reply buttons. Make them match the examples in your response. Keep each under 20 chars."
    ),
});

// Session data interface for tool context
interface SessionContext {
  session: ISession;
  saveSession: () => Promise<void>;
}

// Create tools with execute functions that capture session
const createTools = (ctx: SessionContext) => ({
  save_and_continue: tool({
    description:
      "REQUIRED: Save the user's answer and move to the next question. Call this EVERY time the user answers a question. This saves their data AND advances to the next step automatically.",
    inputSchema: saveDataSchema,
    execute: async (args) => {
      const dataToSave = Object.fromEntries(
        Object.entries(args).filter(
          ([k, v]) => v !== undefined && k !== "next_suggestions"
        )
      ) as Partial<IApplicantData>;

      // Hash secret phrase before storing
      if (dataToSave.secret_phrase) {
        dataToSave.secret_phrase = hashSecretPhrase(dataToSave.secret_phrase);
        console.log("Secret phrase hashed and saved");
      } else {
        console.log("Saving data:", dataToSave);
      }

      // Special handling for email - check if returning user
      if (dataToSave.email) {
        const normalizedEmail = dataToSave.email.toLowerCase().trim();
        dataToSave.email = normalizedEmail;

        // Check if this email already exists in another session
        const existingUserSession = await Session.findOne({
          "applicant_data.email": normalizedEmail,
          session_id: { $ne: ctx.session.session_id }, // Not current session
        });

        if (existingUserSession) {
          console.log("Found existing user with email:", normalizedEmail);

          // Store pending verification - don't restore yet, need secret phrase first
          ctx.session.pending_verification = {
            existing_session_id: existingUserSession.session_id,
            existing_applicant_data: existingUserSession.applicant_data,
            existing_state: existingUserSession.state,
          };

          // Save email to current session
          ctx.session.applicant_data.email = normalizedEmail;

          // Move to secret phrase verification state
          ctx.session.state = "AWAITING_SECRET_PHRASE";

          // Store AI-generated suggestions for next state
          if (args.next_suggestions && args.next_suggestions.length > 0) {
            ctx.session.suggestions = args.next_suggestions;
          }

          // Save to database
          await ctx.saveSession();

          return {
            success: true,
            saved: ["email"],
            new_state: ctx.session.state,
            returning_user: true,
            needs_verification: true,
            user_name: existingUserSession.applicant_data.name || "friend",
          };
        }
      }

      // Merge applicant data
      ctx.session.applicant_data = {
        ...ctx.session.applicant_data,
        ...dataToSave,
      };

      // Store AI-generated suggestions for next state
      if (args.next_suggestions && args.next_suggestions.length > 0) {
        ctx.session.suggestions = args.next_suggestions;
        console.log("Suggestions set:", ctx.session.suggestions);
      }

      // Auto-advance state
      const currentIndex = ONBOARDING_STATES.indexOf(ctx.session.state);
      if (currentIndex < ONBOARDING_STATES.length - 1) {
        ctx.session.state = ONBOARDING_STATES[currentIndex + 1];
        console.log("State advanced to:", ctx.session.state);
      }

      // Save to database
      await ctx.saveSession();

      return {
        success: true,
        saved: Object.keys(dataToSave),
        new_state: ctx.session.state,
      };
    },
  }),
  verify_secret_phrase: tool({
    description:
      "Verify a returning user's secret phrase. Use this when a returning user provides their secret phrase for verification.",
    inputSchema: z.object({
      secret_phrase: z.string().describe("The secret phrase to verify"),
      next_suggestions: z
        .array(z.string())
        .optional()
        .describe("Suggestions for the next question"),
    }),
    execute: async (args) => {
      const { secret_phrase, next_suggestions } = args;

      if (!ctx.session.pending_verification) {
        return {
          success: false,
          error: "No pending verification found",
        };
      }

      const hashedInput = hashSecretPhrase(secret_phrase);
      const storedHash =
        ctx.session.pending_verification.existing_applicant_data.secret_phrase;

      if (hashedInput === storedHash) {
        // Verification successful - restore their data
        const pendingData = ctx.session.pending_verification;

        // Restore applicant data
        ctx.session.applicant_data = {
          ...pendingData.existing_applicant_data,
        };

        // Restore their state (where they left off)
        ctx.session.state = pendingData.existing_state;

        // Delete the old session
        await Session.deleteOne({
          session_id: pendingData.existing_session_id,
        });

        // Clear pending verification
        ctx.session.pending_verification = undefined;

        // Store suggestions
        if (next_suggestions && next_suggestions.length > 0) {
          ctx.session.suggestions = next_suggestions;
        }

        await ctx.saveSession();

        console.log("Secret phrase verified, session restored");
        return {
          success: true,
          verified: true,
          restored_state: ctx.session.state,
          user_name: ctx.session.applicant_data.name,
        };
      } else {
        // Verification failed
        console.log("Secret phrase verification failed");
        return {
          success: true,
          verified: false,
          message: "Secret phrase doesn't match",
        };
      }
    },
  }),
  complete_onboarding: tool({
    description:
      "Complete the onboarding process. Call this at the final step after collecting success_definition.",
    inputSchema: z.object({}),
    execute: async () => {
      ctx.session.state = "COMPLETED";
      ctx.session.applicant_data.submitted_at = new Date().toISOString();
      ctx.session.applicant_data.status = "pending_review";

      // Save to database
      await ctx.saveSession();

      console.log("Onboarding completed!");
      return { success: true, submission_id: ctx.session.session_id };
    },
  }),
});

export async function POST(request: NextRequest) {
  try {
    // Connect to MongoDB
    await connectDB();

    const body = await request.json();
    const { session_id, message_id, user_input, action = "chat" } = body;

    if (!session_id || !message_id) {
      return NextResponse.json(
        { error: "Missing session_id or message_id" },
        { status: 400 }
      );
    }

    // Find or create session in MongoDB
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

    // Helper function to save session
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

    // Handle initialization - send welcome message
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

    // Handle resume - generate a welcome back message
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

    try {
      const systemPrompt = buildSystemPrompt(session);
      const ctx: SessionContext = { session, saveSession };
      const tools = createTools(ctx);

      // Use generateText with tools - execute functions run automatically
      const aiResponse = await generateText({
        model: getAIModel(),
        system: systemPrompt,
        messages: session.messages.map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        })),
        tools,
        stopWhen: stepCountIs(5), // Allow multiple tool calls in sequence
        temperature: 0.7,
      });

      // The text property contains only the human-readable response
      let cleanResponse = aiResponse.text.trim();

      // Remove any function call artifacts that might leak through
      // These patterns handle various formats the model might output
      cleanResponse = cleanResponse
        .replace(/<function=\w+>[\s\S]*?<\/function>/g, "") // <function=name>{...}</function>
        .replace(/<function[^>]*>[\s\S]*?<\/function>/g, "") // <function ...>...</function>
        .replace(/\[function[^\]]*\]/g, "") // [function ...]
        .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "") // <tool_call>...</tool_call>
        .replace(/<\|tool_call\|>[\s\S]*?<\|\/tool_call\|>/g, "") // <|tool_call|>...</|/tool_call|>
        // Clean suggestion artifacts - multiple patterns for different formats
        .replace(/["']?next_suggestions?["']?\s*[:=]\s*\[[^\]]*\],?/gi, "")
        .replace(/["']?suggestions?["']?\s*[:=]\s*\[[^\]]*\],?/gi, "")
        .replace(/["']?next[_\s]?step["']?\s*[:=]\s*["'][^"']*["'],?/gi, "")
        // Clean JSON-like structures containing suggestions
        .replace(/\{[^{}]*["']?next_suggestions?["']?\s*:[^{}]*\}/gi, "")
        .replace(/\{[^{}]*["']?suggestions?["']?\s*:[^{}]*\}/gi, "")
        // Clean standalone arrays that look like suggestions
        .replace(
          /\[\s*["'][^"']+["']\s*(,\s*["'][^"']+["']\s*)*\](?=\s*$|\s*\n)/gm,
          ""
        )
        // Clean any remaining orphaned JSON punctuation
        .replace(/^\s*[,:\[\]{}]+\s*$/gm, "")
        // Clean multiple newlines
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      // If the response is now empty or just whitespace, provide a fallback
      if (!cleanResponse || cleanResponse.length < 2) {
        cleanResponse = "hmm, let me think about that. try again?";
      }

      session.messages.push({ role: "assistant", content: cleanResponse });
      await saveSession();

      // Get suggestions - prefer AI-generated, fallback to defaults
      const responseSuggestions =
        session.suggestions.length > 0
          ? session.suggestions
          : DEFAULT_SUGGESTIONS[session.state] || [];

      console.log(
        "Returning state:",
        session.state,
        "with suggestions:",
        responseSuggestions
      );

      return NextResponse.json({
        assistant_message: cleanResponse,
        server_state: {
          session_id: session.session_id,
          state: session.state,
          completed: session.state === "COMPLETED",
        },
        suggestions: responseSuggestions,
      });
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
