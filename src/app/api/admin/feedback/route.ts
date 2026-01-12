import { type NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Feedback from "@/lib/models/feedback";
import { verifyToken } from "@/lib/jwt";

// GET - Fetch all feedback submissions
export async function GET(request: NextRequest) {
  try {
    // Verify admin token
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    await connectDB();

    // Fetch all feedback sorted by creation date (newest first)
    const feedback = await Feedback.find({}).sort({ created_at: -1 }).lean();

    return NextResponse.json({ feedback });
  } catch (error) {
    console.error("Admin feedback GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
