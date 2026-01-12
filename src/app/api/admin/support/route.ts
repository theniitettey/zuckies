import { type NextRequest, NextResponse } from "next/server";
import ai from "@/app/api/chat/ai/config";
import { googleAI } from "@genkit-ai/google-genai";
import connectDB from "@/lib/mongodb";
import Session from "@/lib/models/session";
import { buildAdminPrompt } from "../prompt";
import { createAdminTools } from "@/app/api/admin/tools";

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

    const { message } = await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    // Fetch all completed applications once
    const applicants = await Session.find({ state: "COMPLETED" }).lean();

    // Create callback for status updates
    const onStatusChange = async (sessionId: string, status: string) => {
      await Session.findByIdAndUpdate(sessionId, {
        "applicant_data.application_status": status,
        "applicant_data.reviewed_at": new Date().toISOString(),
      });
    };

    const systemPrompt = buildAdminPrompt();

    // Create admin tools with applicants data
    const tools = createAdminTools(applicants, onStatusChange);

    // Build message history
    const messages = [
      {
        role: "user" as const,
        content: [{ text: message }],
      },
    ];

    // Generate response with tools
    let response;
    try {
      response = await ai.generate({
        model: googleAI.model("gemini-2-flash"),
        system: systemPrompt,
        messages,
        tools,
        config: {
          temperature: 0.7,
        },
        maxTurns: 10, // Allow tool calls + final response
      });
    } catch (error) {
      console.error("AI generation error:", error);
      throw error;
    }

    // Extract text response
    const textContent = response.text;

    return NextResponse.json({
      message: textContent,
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
