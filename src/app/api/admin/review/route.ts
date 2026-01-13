import { type NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Applicant, { type ApplicationStatus } from "@/lib/models/applicant";
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

    // Build query - only show applicants who have submitted
    const query: Record<string, unknown> = {
      submitted_at: { $exists: true, $ne: null },
    };

    if (status) {
      query.application_status = status;
    }

    if (email) {
      query.email = email.toLowerCase();
    }

    const applications = await Applicant.find(query)
      .select({
        email: 1,
        name: 1,
        engineering_area: 1,
        skill_level: 1,
        career_goals: 1,
        github: 1,
        linkedin: 1,
        portfolio: 1,
        projects: 1,
        time_commitment: 1,
        submitted_at: 1,
        application_status: 1,
        review_notes: 1,
        reviewed_at: 1,
        reviewed_by: 1,
        created_at: 1,
        updated_at: 1,
      })
      .sort({ submitted_at: -1 })
      .lean();

    // Summary stats
    const allSubmitted = await Applicant.find({
      submitted_at: { $exists: true, $ne: null },
    }).lean();
    const stats = {
      total: allSubmitted.length,
      pending: allSubmitted.filter(
        (a) => !a.application_status || a.application_status === "pending"
      ).length,
      accepted: allSubmitted.filter((a) => a.application_status === "accepted")
        .length,
      rejected: allSubmitted.filter((a) => a.application_status === "rejected")
        .length,
      waitlisted: allSubmitted.filter(
        (a) => a.application_status === "waitlisted"
      ).length,
    };

    return NextResponse.json({
      stats,
      applications: applications.map((app) => ({
        email: app.email,
        applicant_data: {
          name: app.name,
          email: app.email,
          engineering_area: app.engineering_area,
          skill_level: app.skill_level,
          career_goals: app.career_goals,
          github: app.github,
          linkedin: app.linkedin,
          portfolio: app.portfolio,
          projects: app.projects,
          time_commitment: app.time_commitment,
          submitted_at: app.submitted_at,
          application_status: app.application_status,
          review_notes: app.review_notes,
          reviewed_at: app.reviewed_at,
          reviewed_by: app.reviewed_by,
        },
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
    const { email, application_status, review_notes, reviewed_by } = body;

    // Validate status - convert "approved" to "accepted" for compatibility
    let status: ApplicationStatus = application_status as ApplicationStatus;
    if (application_status === "approved") {
      status = "accepted";
    }

    const validStatuses: ApplicationStatus[] = [
      "pending",
      "accepted",
      "rejected",
      "waitlisted",
    ];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        {
          error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Find and update applicant
    const applicant = await Applicant.findOne({ email: email?.toLowerCase() });

    if (!applicant) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    if (!applicant.submitted_at) {
      return NextResponse.json(
        { error: "Cannot review an incomplete application" },
        { status: 400 }
      );
    }

    // Update application status
    const previousStatus = applicant.application_status;
    applicant.application_status = status;
    applicant.reviewed_at = new Date().toISOString();
    applicant.reviewed_by = process.env.ADMIN_USERNAME || "admin";

    if (review_notes) {
      applicant.review_notes = review_notes;
    }

    await applicant.save();

    console.log(
      `Application status updated: ${applicant.email} - ${previousStatus} → ${status}`
    );

    return NextResponse.json({
      success: true,
      message: `Application ${status}!`,
      application: {
        email: applicant.email,
        name: applicant.name,
        previous_status: previousStatus,
        new_status: status,
        review_notes: applicant.review_notes,
        reviewed_at: applicant.reviewed_at,
        reviewed_by: applicant.reviewed_by,
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
