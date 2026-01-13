import { type NextRequest, NextResponse } from "next/server";
import ai from "@/app/api/chat/ai/config";
import { googleAI } from "@genkit-ai/google-genai";
import connectDB from "@/lib/mongodb";
import Applicant from "@/lib/models/applicant";
import AdminSession from "@/lib/models/admin-session";
import { buildAdminPrompt } from "../prompt";
import { createAdminTools } from "@/app/api/admin/tools";
import { v4 as uuidv4 } from "uuid";

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
    // Connect to database
    await connectDB();

    const { message, session_id } = await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Get or create admin session
    let adminSession = session_id
      ? await AdminSession.findOne({ session_id })
      : null;

    if (!adminSession) {
      const newSessionId = session_id || `admin-${uuidv4()}`;
      adminSession = await AdminSession.create({
        admin_id: "admin", // Default admin ID
        session_id: newSessionId,
        messages: [],
        notes: [],
      });
    }

    // Fetch all submitted applications once
    const applicants = await Applicant.find({
      submitted_at: { $exists: true, $ne: null },
    }).lean();

    // Create callback for status updates
    const onStatusChange = async (email: string, status: string) => {
      await Applicant.findOneAndUpdate(
        { email: email.toLowerCase() },
        {
          $set: {
            application_status: status,
            reviewed_at: new Date().toISOString(),
          },
        }
      );
    };

    // Create callback for saving notes
    const onSaveNote = async (key: string, value: string) => {
      const existingNoteIndex = adminSession.notes.findIndex(
        (n) => n.key === key
      );

      if (existingNoteIndex >= 0) {
        adminSession.notes[existingNoteIndex].value = value;
        adminSession.notes[existingNoteIndex].updated_at = new Date();
      } else {
        adminSession.notes.push({
          key,
          value,
          created_at: new Date(),
          updated_at: new Date(),
        });
      }

      await adminSession.save();
    };

    // Create callback for getting notes
    const onGetNotes = async (keyPrefix?: string): Promise<string> => {
      if (!adminSession) return "no session found";

      let notes = adminSession.notes;

      if (keyPrefix) {
        notes = notes.filter((n) => n.key.startsWith(keyPrefix));
      }

      if (notes.length === 0) {
        return keyPrefix
          ? `no notes found with prefix: ${keyPrefix}`
          : "no notes saved yet";
      }

      return notes
        .map((n) => `**${n.key}**: ${n.value} (updated: ${n.updated_at})`)
        .join("\n\n");
    };

    const systemPrompt = buildAdminPrompt();

    // Create admin tools with applicants data and callbacks
    const tools = createAdminTools(
      applicants,
      onStatusChange,
      onSaveNote,
      onGetNotes
    );

    // Build message history from session
    const messageHistory = adminSession.messages.map((msg) => ({
      role: msg.role === "admin" ? ("user" as const) : ("model" as const),
      content: [{ text: msg.content }],
    }));

    // Add current user message
    messageHistory.push({
      role: "user" as const,
      content: [{ text: message }],
    });

    // Save user message to session
    adminSession.messages.push({
      role: "admin",
      content: message,
      timestamp: new Date(),
    });

    // Generate response with tools
    let response;
    try {
      response = await ai.generate({
        model: googleAI.model("gemini-2.5-flash"),
        system: systemPrompt,
        messages: messageHistory,
        tools,
        config: {
          temperature: 0.7,
        },
        maxTurns: 20, // Allow tool calls + final response
      });
    } catch (error) {
      console.error("AI generation error:", error);
      throw error;
    }

    // Extract text response
    const textContent = response.text;

    // Save assistant response to session
    adminSession.messages.push({
      role: "assistant",
      content: textContent,
      timestamp: new Date(),
    });

    await adminSession.save();

    return NextResponse.json({
      message: textContent,
      session_id: adminSession.session_id,
    });
  } catch (error) {
    console.error("Admin assistant error:", error);

    // Fallback response
    return NextResponse.json({
      message:
        "couldn't process that right now. try again or refresh and let's continue.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
