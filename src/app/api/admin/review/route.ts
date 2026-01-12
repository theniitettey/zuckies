import { type NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Session, { type ApplicationStatus } from "@/lib/models/session";
import { signToken, verifyToken } from "@/lib/jwt";

// Admin credentials from environment
const ADMIN_PASSWORD = process.env.ADMIN_SECRET || "sidequest-admin-2024";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";

// POST - Authenticate admin with username and password, generate token
export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    // Verify username and password
    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Generate admin token (valid for 24 hours)
    const token = signToken({
      email: ADMIN_USERNAME,
      sessionId: "admin-session",
    });

    return NextResponse.json({ token, username: ADMIN_USERNAME });
  } catch (error) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

// GET - List all applications (with optional status filter)
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    const status = searchParams.get("status") as ApplicationStatus | null;
    const email = searchParams.get("email");

    // Verify token
    if (!token || !verifyToken(token)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Build query
    const query: Record<string, unknown> = {
      state: "COMPLETED", // Only show completed applications
    };

    if (status) {
      query["applicant_data.application_status"] = status;
    }

    if (email) {
      query["applicant_data.email"] = email.toLowerCase();
    }

    const applications = await Session.find(query)
      .select({
        session_id: 1,
        state: 1,
        "applicant_data.name": 1,
        "applicant_data.email": 1,
        "applicant_data.engineering_area": 1,
        "applicant_data.skill_level": 1,
        "applicant_data.career_goals": 1,
        "applicant_data.github": 1,
        "applicant_data.linkedin": 1,
        "applicant_data.portfolio": 1,
        "applicant_data.projects": 1,
        "applicant_data.time_commitment": 1,
        "applicant_data.submitted_at": 1,
        "applicant_data.application_status": 1,
        "applicant_data.review_notes": 1,
        "applicant_data.reviewed_at": 1,
        "applicant_data.reviewed_by": 1,
        created_at: 1,
        updated_at: 1,
      })
      .sort({ "applicant_data.submitted_at": -1 })
      .lean();

    // Summary stats
    const allCompleted = await Session.find({ state: "COMPLETED" }).lean();
    const stats = {
      total: allCompleted.length,
      pending: allCompleted.filter(
        (a) =>
          !a.applicant_data?.application_status ||
          a.applicant_data.application_status === "pending"
      ).length,
      accepted: allCompleted.filter(
        (a) => a.applicant_data?.application_status === "accepted"
      ).length,
      rejected: allCompleted.filter(
        (a) => a.applicant_data?.application_status === "rejected"
      ).length,
      waitlisted: allCompleted.filter(
        (a) => a.applicant_data?.application_status === "waitlisted"
      ).length,
    };

    return NextResponse.json({
      stats,
      applications: applications.map((app) => ({
        session_id: app.session_id,
        state: app.state,
        applicant_data: app.applicant_data,
        created_at: app.created_at,
        updated_at: app.updated_at,
      })),
    });
  } catch (error) {
    console.error("Admin GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH - Update application status (for admin interface)
export async function PATCH(request: NextRequest) {
  try {
    await connectDB();

    const authHeader = request.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");

    // Verify token
    if (!token || !verifyToken(token)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { session_id, application_status, review_notes, reviewed_by } = body;

    // Validate status - convert "approved" to "accepted" for compatibility
    let status: ApplicationStatus = application_status as ApplicationStatus;
    if (application_status === "approved") {
      status = "accepted";
    }

    const validStatuses: ApplicationStatus[] = [
      "pending",
      "accepted",
      "rejected",
    ];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        {
          error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Find and update session
    const session = await Session.findOne({ session_id });

    if (!session) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    if (session.state !== "COMPLETED") {
      return NextResponse.json(
        { error: "Cannot review an incomplete application" },
        { status: 400 }
      );
    }

    // Update application status
    const previousStatus = session.applicant_data.application_status;
    session.applicant_data.application_status = status;
    session.applicant_data.reviewed_at = new Date().toISOString();
    session.applicant_data.reviewed_by = process.env.ADMIN_USERNAME || "admin";

    if (review_notes) {
      session.applicant_data.review_notes = review_notes;
    }

    await session.save();

    console.log(
      `Application status updated: ${session.applicant_data.email} - ${previousStatus} → ${status}`
    );

    return NextResponse.json({
      success: true,
      message: `Application ${status}!`,
      application: {
        session_id: session.session_id,
        email: session.applicant_data.email,
        name: session.applicant_data.name,
        previous_status: previousStatus,
        new_status: status,
        review_notes: session.applicant_data.review_notes,
        reviewed_at: session.applicant_data.reviewed_at,
        reviewed_by: session.applicant_data.reviewed_by,
      },
    });
  } catch (error) {
    console.error("Admin PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
