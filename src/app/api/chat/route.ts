import { type NextRequest, NextResponse } from "next/server";
import { googleAI } from "@genkit-ai/google-genai";
import connectDB from "@/lib/mongodb";
import { signToken, verifyToken } from "@/lib/jwt";
import Session, {
  ONBOARDING_STATES,
  type OnboardingState,
  type ISession,
  type IApplicantData,
  type IMessage,
} from "@/lib/models/session";
import Applicant, { type IApplicant } from "@/lib/models/applicant";
import { DEFAULT_SUGGESTIONS, WELCOME_MESSAGE } from "./ai/constants";
import { generateStateFallback } from "./ai/fallbacks";
import { buildSystemPrompt } from "./ai/prompt";
import { createTools } from "./ai/tools";
import ai from "./ai/config";

// Suppress expected Genkit tool re-registration warnings
const originalError = console.error;
const toolErrorFilter = (...args: any[]) => {
  const message = args[0]?.toString?.() || "";
  if (message.includes("already has an entry in the registry")) {
    return; // Suppress this expected warning
  }
  originalError(...args);
};
console.error = toolErrorFilter;

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { token, message_id, user_input, action = "chat" } = body;

    // For init action, we create a new session and issue a token
    // For other actions, we need a valid token
    let session_id: string;
    let email: string | undefined;

    if (action === "init") {
      // New session - generate session ID
      session_id = crypto.randomUUID();
    } else if (token) {
      // Verify existing token
      const payload = verifyToken(token);
      if (!payload) {
        return NextResponse.json(
          { error: "Invalid or expired token. Please start a new session." },
          { status: 401 }
        );
      }
      session_id = payload.sessionId;
      email = payload.email;
    } else {
      return NextResponse.json(
        { error: "Token required for this action" },
        { status: 401 }
      );
    }

    if (!message_id) {
      return NextResponse.json(
        { error: "Missing message_id" },
        { status: 400 }
      );
    }

    let session = await Session.findOne({ session_id });

    // For returning users with email in token, try to restore their full profile
    let isReturningUser = false;
    let applicantProfile: IApplicant | null = null;

    if (!session && email && !email.includes("@sessions.local")) {
      // Check if this email has an existing Applicant record (completed users)
      applicantProfile = await Applicant.findOne({
        email: email.toLowerCase().trim(),
      });

      // Also check for existing session with this email
      const existingSession = await Session.findOne({
        "applicant_data.email": email.toLowerCase().trim(),
      });

      if (applicantProfile || existingSession) {
        isReturningUser = true;
        console.log("Returning user detected via email:", email);

        // Use existing session if found, or create new one with restored data
        if (existingSession) {
          session = existingSession;
          // Update session_id to the new one for this browser session
          session.session_id = session_id;
          console.log("Restored existing session for returning user");
        }
      }
    }

    if (!session) {
      // Build applicant_data from Applicant record if available (returning user)
      const restoredData: Partial<IApplicantData> = email ? { email } : {};
      let initialState: OnboardingState = "FREE_CHAT";
      let recentMessages: IMessage[] = [];

      if (applicantProfile) {
        // Restore full profile from Applicant model
        restoredData.email = applicantProfile.email;
        restoredData.secret_phrase = applicantProfile.secret_phrase_hash;
        restoredData.name = applicantProfile.name;
        restoredData.whatsapp = applicantProfile.whatsapp;
        restoredData.engineering_area = applicantProfile.engineering_area;
        restoredData.skill_level = applicantProfile.skill_level;
        restoredData.improvement_goals = applicantProfile.improvement_goals;
        restoredData.career_goals = applicantProfile.career_goals;
        restoredData.github = applicantProfile.github;
        restoredData.linkedin = applicantProfile.linkedin;
        restoredData.portfolio = applicantProfile.portfolio;
        restoredData.projects = applicantProfile.projects;
        restoredData.time_commitment = applicantProfile.time_commitment;
        restoredData.learning_style = applicantProfile.learning_style;
        restoredData.tech_focus = applicantProfile.tech_focus;
        restoredData.success_definition = applicantProfile.success_definition;
        restoredData.application_status = applicantProfile.application_status;
        restoredData.submitted_at = applicantProfile.submitted_at;
        restoredData.review_notes = applicantProfile.review_notes;
        restoredData.reviewed_at = applicantProfile.reviewed_at;

        // Returning completed user goes to FREE_CHAT
        initialState = "FREE_CHAT";
        console.log("Restored profile from Applicant model, state: FREE_CHAT");

        // Try to load recent messages from their most recent session
        try {
          const recentSession = await Session.findOne({
            "applicant_data.email": applicantProfile.email,
          })
            .sort({ updated_at: -1 })
            .limit(1);

          if (recentSession && recentSession.messages.length > 0) {
            // Take the last 10 messages for context (not too many to overwhelm)
            recentMessages = recentSession.messages.slice(-10);
            console.log(
              `Loaded ${recentMessages.length} recent messages from previous session`
            );
          }
        } catch (err) {
          console.log("Could not load recent messages:", err);
        }
      }

      session = new Session({
        session_id,
        state: initialState,
        messages: recentMessages, // Include recent messages for context
        applicant_data: restoredData,
        applicant_email: applicantProfile?.email,
        processed_messages: [],
        suggestions: [],
      });
      await session.save();
      console.log(
        "New session created:",
        session_id,
        "returning:",
        isReturningUser,
        "with",
        recentMessages.length,
        "context messages"
      );
    }

    // Helper function to generate token for response
    const generateResponseToken = () => {
      const sessionEmail = session!.applicant_data?.email || email || "";
      if (sessionEmail) {
        return signToken({ email: sessionEmail, sessionId: session_id });
      }
      // For sessions without email yet, create a temporary token with valid email format
      return signToken({
        email: `pending+${session_id}@sessions.local`,
        sessionId: session_id,
      });
    };

    const saveSession = async () => {
      await session!.save();
    };

    // Handle duplicate messages
    if (session.processed_messages.includes(message_id)) {
      const lastMessage = session.messages[session.messages.length - 1];
      // Only mark as completed if they have actually finished onboarding (have application_status)
      const hasApplicationStatus = !!session.applicant_data?.application_status;
      const isCompleted =
        (session.state === "COMPLETED" || session.state === "FREE_CHAT") &&
        hasApplicationStatus;
      return NextResponse.json({
        assistant_message: lastMessage?.content || "try again.",
        token: generateResponseToken(),
        server_state: {
          session_id: session.session_id,
          state: session.state,
          completed: isCompleted,
          application_status: hasApplicationStatus
            ? session.applicant_data?.application_status
            : undefined,
          user_name: isCompleted ? session.applicant_data?.name : undefined,
        },
        suggestions:
          session.suggestions.length > 0
            ? session.suggestions
            : DEFAULT_SUGGESTIONS[session.state] || [],
      });
    }

    // Handle initialization - check if this is a returning completed user
    if (action === "init") {
      session.processed_messages.push(message_id);

      // Check if this is a completed/free_chat user returning - recognize them!
      const isCompletedUser =
        session.state === "COMPLETED" || session.state === "FREE_CHAT";
      const userName = session.applicant_data?.name;
      const userProfile = session.applicant_data;

      // Only send welcome message to returning users with a name
      let welcomeMsg = "";
      let shouldSendMessage = false;

      if (isCompletedUser && userName) {
        shouldSendMessage = true;
        // Build a personalized welcome based on their profile
        const statusEmoji =
          userProfile?.application_status === "accepted"
            ? "🎉"
            : userProfile?.application_status === "rejected"
            ? "💪"
            : userProfile?.application_status === "waitlisted"
            ? "📋"
            : "⏳";

        const personalTouches: string[] = [];
        if (userProfile?.tech_focus) {
          personalTouches.push(
            `still grinding that ${userProfile.tech_focus}?`
          );
        }
        if (userProfile?.career_goals) {
          personalTouches.push(
            `working towards your goal to ${userProfile.career_goals.toLowerCase()}?`
          );
        }
        if (userProfile?.engineering_area) {
          personalTouches.push(
            `how's the ${userProfile.engineering_area} journey going?`
          );
        }

        // Pick one random personal touch to avoid overwhelming
        const personalTouch =
          personalTouches.length > 0
            ? personalTouches[
                Math.floor(Math.random() * personalTouches.length)
              ]
            : "how's everything going?";

        // Returning completed user - welcome them back warmly with context
        welcomeMsg = `hey ${userName}! 👋 welcome back!

![welcome back](https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM2RlOGZjYzJjZDE5NjFlOTczZDk5Y2Y3ZjM5ZGQ5YmZhNjFhNDhmMiZlcD12MV9naWZzX3NlYXJjaCZjdD1n/xUPGGDNsLvqsBOhuU0/giphy.gif)

i remember you! ${statusEmoji} your application is **${
          userProfile?.application_status || "pending"
        }**.

${personalTouch}

what can i help you with today? wanna chat, have a meme war, get some coding help, or something else? 🚀`;

        // Make sure they're in FREE_CHAT mode for returning users
        if (session.state === "COMPLETED") {
          session.state = "FREE_CHAT" as OnboardingState;
        }
      }

      // Only save message if we have one to send
      if (shouldSendMessage) {
        session.messages.push({ role: "assistant", content: welcomeMsg });
      }
      await saveSession();

      // Only mark as completed if they have actually finished onboarding (have application_status)
      const hasApplicationStatus = !!session.applicant_data?.application_status;
      const isCompleted = isCompletedUser && hasApplicationStatus;
      return NextResponse.json({
        assistant_message: welcomeMsg || "", // Empty string for new users
        token: generateResponseToken(),
        server_state: {
          session_id: session.session_id,
          state: session.state,
          completed: isCompleted,
          application_status: hasApplicationStatus
            ? session.applicant_data?.application_status
            : undefined,
          user_name: isCompleted ? session.applicant_data?.name : undefined,
        },
        suggestions: DEFAULT_SUGGESTIONS[session.state] || [],
      });
    }

    // Handle resume
    if (action === "resume") {
      session.processed_messages.push(message_id);
      // Only show application_status if user has actually been through onboarding (has a status set)
      const hasApplicationStatus = !!session.applicant_data?.application_status;
      const currentPhase = session.state
        .replace("AWAITING_", "")
        .toLowerCase()
        .replace(/_/g, " ");

      // Generate appropriate resume message based on state
      const isCompletedUser =
        session.state === "COMPLETED" || session.state === "FREE_CHAT";
      const userName = session.applicant_data?.name;
      const userProfile = session.applicant_data;

      let resumeMessage: string;
      if (isCompletedUser && userName) {
        // Returning completed user - make it personal!
        const statusEmoji =
          userProfile?.application_status === "accepted"
            ? "🎉"
            : userProfile?.application_status === "rejected"
            ? "💪"
            : userProfile?.application_status === "waitlisted"
            ? "📋"
            : "⏳";

        const personalTouches: string[] = [];
        if (userProfile?.tech_focus) {
          personalTouches.push(
            `still grinding that ${userProfile.tech_focus}?`
          );
        }
        if (userProfile?.projects) {
          personalTouches.push(`how are those projects going?`);
        }
        if (userProfile?.engineering_area) {
          personalTouches.push(
            `any new ${userProfile.engineering_area} adventures?`
          );
        }

        const personalTouch =
          personalTouches.length > 0
            ? `\n\n${
                personalTouches[
                  Math.floor(Math.random() * personalTouches.length)
                ]
              }`
            : "";

        resumeMessage = `hey ${userName}! ${statusEmoji} welcome back!\n\nyour application is **${
          userProfile?.application_status || "pending"
        }**.${personalTouch}\n\nwhat can i help you with today? wanna chat, have a meme war, or need something specific?`;

        // Ensure they're in FREE_CHAT mode
        if (session.state === "COMPLETED") {
          session.state = "FREE_CHAT" as OnboardingState;
        }
      } else if (userName) {
        // Still onboarding but we know their name
        resumeMessage = `welcome back ${userName}! 👋\n\nlet's pick up where we left off. we were just about to talk about your **${currentPhase}**.`;
      } else {
        // Still onboarding, don't know name yet
        resumeMessage = `welcome back! 👋\n\nlet's pick up where we left off. we were just about to talk about your **${currentPhase}**.`;
      }

      session.messages.push({ role: "assistant", content: resumeMessage });
      await saveSession();

      // Only mark as completed if they have actually finished onboarding (have application_status)
      const isCompleted = isCompletedUser && hasApplicationStatus;
      return NextResponse.json({
        assistant_message: resumeMessage,
        token: generateResponseToken(),
        server_state: {
          session_id: session.session_id,
          state: session.state,
          completed: isCompleted,
          application_status: hasApplicationStatus
            ? session.applicant_data?.application_status
            : undefined,
          user_name: isCompleted ? session.applicant_data?.name : undefined,
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

    console.log("📨 User message received:");
    console.log("- Session ID:", session_id);
    console.log("- Message ID:", message_id);
    console.log("- User input:", user_input);
    console.log("- Session state:", session.state);
    console.log("- Total messages:", session.messages.length);

    // Track if tools need to save
    let needsSave = false;
    const markPendingSave = () => {
      needsSave = true;
    };

    // Create dynamic tools with session and auth context
    const tools = createTools(session, saveSession, markPendingSave, {
      token,
      tokenEmail: email,
      sessionId: session_id,
    });

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
      console.log(
        "Available tools:",
        tools.map((t) => t.name || "unknown")
      );

      // Single AI generate call - NO RETRY (retrying re-runs tools which breaks state)
      let response;
      try {
        response = await ai.generate({
          model: googleAI.model("gemini-3-flash-preview"),
          system: systemPrompt,
          messages: messages,
          tools,
          config: {
            temperature: 0.7,
          },
          maxTurns: 10, // Increased to allow more tool calls + final response
        });

        console.log("AI response received:");
        console.log("- Text length:", response?.text?.length || 0);
        console.log("- Has text:", !!response?.text);
        console.log(
          "- Response object keys:",
          response ? Object.keys(response) : "null"
        );
        console.log("- Tool calls made:", response?.toolCalls?.length || 0);
        console.log("- Finish reason:", response?.finishReason);

        // Log the full response object for debugging
        console.log("-🤖AI Response: ", response.text);
      } catch (genError) {
        console.error("AI generate error:", genError);
        // Don't retry - just use fallback
        response = null;
      }

      // Generate fallback message based on state if AI failed
      let aiText = response?.text?.trim();
      if (!aiText) {
        console.log("No AI text, generating state-based fallback...");

        // Check if meme war was just started (pending_action = meme_war)
        if (session.pending_action === "meme_war") {
          console.log(
            "Meme war detected but no AI text - using meme war fallback"
          );
          aiText = `oya now! ⚔️ meme war started!

let the battle begin! drop your best meme and let's see what you got 😤

(the AI tried to send a meme but something went wrong - but the war is still on! 🔥)`;
        } else {
          aiText = generateStateFallback(
            session.state,
            session.applicant_data?.name,
            !!session.pending_verification
          );
        }
      }

      // Save final message and any pending tool changes
      session.messages.push({ role: "assistant", content: aiText });
      if (needsSave) {
        console.log("Saving pending tool changes...");
      }
      await saveSession();

      // Reload session from DB to get the most up-to-date state after tool execution
      const updatedSession = await Session.findOne({ session_id });
      const finalState = updatedSession?.state || session.state;
      // Only mark as completed if they have actually finished onboarding (have application_status)
      const hasCompletedOnboarding =
        !!updatedSession?.applicant_data?.application_status;
      const isCompleted =
        (finalState === "COMPLETED" || finalState === "FREE_CHAT") &&
        hasCompletedOnboarding;
      const pendingAction = updatedSession?.pending_action || null;

      // Clear pending action after reading it
      if (pendingAction && updatedSession) {
        updatedSession.pending_action = null;
        await updatedSession.save();
      }

      // Get AI-generated suggestions or fall back to defaults
      const finalSuggestions =
        updatedSession?.suggestions && updatedSession.suggestions.length > 0
          ? updatedSession.suggestions
          : DEFAULT_SUGGESTIONS[finalState as OnboardingState] || [];

      console.log("Response received, text length:", aiText.length);
      console.log("Final state after tools:", finalState);
      console.log("Pending action:", pendingAction);
      console.log("Suggestions:", finalSuggestions);

      // Generate token for response (refresh if needed)
      const responseToken = generateResponseToken();

      // Get applicant data for completed users from cached session data
      // No need to query Applicant model on every request - check_application_status tool
      // already syncs the status when user explicitly asks, and status changes are rare
      let applicationStatus:
        | "pending"
        | "accepted"
        | "rejected"
        | "waitlisted"
        | undefined = undefined;
      let userName: string | undefined;

      // Only include application_status if user has one (completed onboarding with results)
      if (isCompleted && updatedSession?.applicant_data?.application_status) {
        applicationStatus = updatedSession.applicant_data.application_status as
          | "pending"
          | "accepted"
          | "rejected"
          | "waitlisted";
        userName = updatedSession.applicant_data.name;
      }

      return new Response(
        new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();

            // Send response in larger chunks - client handles the typing animation
            let charIndex = 0;
            const chunkSize = 100; // Larger chunks since client animates

            const sendNextChunk = () => {
              if (charIndex >= aiText.length) {
                // Send final event with updated state info from DB
                const finalData = JSON.stringify({
                  type: "done",
                  token: responseToken,
                  server_state: {
                    session_id: session.session_id,
                    state: finalState,
                    completed: isCompleted,
                    action: pendingAction,
                    application_status: isCompleted
                      ? applicationStatus
                      : undefined,
                    user_name: isCompleted ? userName : undefined,
                  },
                  suggestions: finalSuggestions,
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

      // Use state-based fallback instead of generic error
      const fallbackMessage = generateStateFallback(
        session.state,
        session.applicant_data?.name,
        !!session.pending_verification
      );
      session.messages.push({ role: "assistant", content: fallbackMessage });

      // Still save any pending changes from tools that ran before error
      if (needsSave) {
        console.log("Saving pending tool changes despite AI error...");
      }
      await saveSession();

      // Reload to get updated state
      const updatedSession = await Session.findOne({ session_id });
      const currentState = updatedSession?.state || session.state;
      const isCompletedState =
        currentState === "COMPLETED" || currentState === "FREE_CHAT";

      return NextResponse.json({
        assistant_message: fallbackMessage,
        token: generateResponseToken(),
        server_state: {
          session_id: session.session_id,
          state: currentState,
          completed: isCompletedState,
          application_status: isCompletedState
            ? updatedSession?.applicant_data?.application_status
            : undefined,
          user_name: isCompletedState
            ? updatedSession?.applicant_data?.name
            : undefined,
        },
        suggestions: DEFAULT_SUGGESTIONS[currentState as OnboardingState] || [],
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
