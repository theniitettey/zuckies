import { type NextRequest, NextResponse } from "next/server";
import ai from "@/app/api/chat/ai/config";
import { googleAI } from "@genkit-ai/google-genai";
import { buildAdminPrompt } from "../prompt";
import { createAdminTools } from "../tools";

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
    const { message } = await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const systemPrompt = buildAdminPrompt();

    // Create admin tools
    const tools = createAdminTools();

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
