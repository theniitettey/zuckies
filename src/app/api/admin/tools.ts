import { genkit, z } from "genkit";
import connectDB from "@/lib/mongodb";
import Session, { type ApplicationStatus } from "@/lib/models/session";
import ai from "@/app/api/chat/ai/config";

// Admin review tool for updating application status
export function createAdminReviewTool() {
  return ai.defineTool(
    {
      name: "review_application",
      description:
        "Update an applicant's review status (approved=accepted, rejected, or mark pending)",
      inputSchema: z.object({
        session_id: z.string().describe("The session ID of the applicant"),
        status: z
          .enum(["accepted", "rejected", "pending"])
          .describe("The review status to set"),
        notes: z
          .string()
          .optional()
          .describe("Optional review notes for the applicant"),
      }),
    },
    async (input) => {
      try {
        await connectDB();

        const session = await Session.findOne({ session_id: input.session_id });
        if (!session) {
          return `applicant not found with session id ${input.session_id}`;
        }

        const previousStatus =
          (session.applicant_data?.application_status as ApplicationStatus) ||
          "pending";
        session.applicant_data.application_status =
          input.status as ApplicationStatus;
        session.applicant_data.reviewed_at = new Date().toISOString();

        if (input.notes) {
          session.applicant_data.review_notes = input.notes;
        }

        await session.save();

        return `${session.applicant_data.name}'s application has been ${input.status}. (was ${previousStatus})`;
      } catch (error) {
        return `error updating application: ${
          error instanceof Error ? error.message : "unknown error"
        }`;
      }
    }
  );
}

// Get applicant details tool
export function createGetApplicantTool() {
  return ai.defineTool(
    {
      name: "get_applicant_details",
      description:
        "Get detailed information about an applicant by session ID or email",
      inputSchema: z.object({
        session_id: z.string().optional().describe("Session ID of applicant"),
        email: z.string().optional().describe("Email of applicant"),
      }),
    },
    async (input) => {
      try {
        await connectDB();

        let query: Record<string, unknown> = {};
        if (input.session_id) {
          query.session_id = input.session_id;
        } else if (input.email) {
          query["applicant_data.email"] = input.email.toLowerCase();
        } else {
          return "must provide session_id or email";
        }

        const session = await Session.findOne(query);
        if (!session) {
          return "applicant not found";
        }

        const applicant = session.applicant_data;
        return `
Name: ${applicant?.name}
Email: ${applicant?.email}
Area: ${applicant?.engineering_area}
Level: ${applicant?.skill_level}
Goals: ${applicant?.career_goals}
GitHub: ${applicant?.github || "not provided"}
LinkedIn: ${applicant?.linkedin || "not provided"}
Portfolio: ${applicant?.portfolio || "not provided"}
Time Commitment: ${applicant?.time_commitment}
Status: ${applicant?.application_status || "pending"}
Submitted: ${applicant?.submitted_at}
${applicant?.review_notes ? `Notes: ${applicant.review_notes}` : ""}
        `;
      } catch (error) {
        return `error fetching applicant: ${
          error instanceof Error ? error.message : "unknown error"
        }`;
      }
    }
  );
}

// List applicants with filters
export function createListApplicantsTool() {
  return ai.defineTool(
    {
      name: "list_applicants",
      description:
        "List applicants with optional filtering by status or search term",
      inputSchema: z.object({
        status: z
          .enum(["all", "pending", "accepted", "rejected"])
          .optional()
          .describe("Filter by review status"),
        limit: z
          .number()
          .optional()
          .default(10)
          .describe("Number of results to return (max 50)"),
        search: z.string().optional().describe("Search by name or email"),
      }),
    },
    async (input) => {
      try {
        await connectDB();

        const limit = Math.min(input.limit || 10, 50);
        let query: Record<string, unknown> = { state: "COMPLETED" };

        if (input.status && input.status !== "all") {
          query["applicant_data.application_status"] = input.status;
        }

        if (input.search) {
          const searchRegex = new RegExp(input.search, "i");
          query.$or = [
            { "applicant_data.name": searchRegex },
            { "applicant_data.email": searchRegex },
          ];
        }

        const applicants = await Session.find(query)
          .select({
            session_id: 1,
            "applicant_data.name": 1,
            "applicant_data.email": 1,
            "applicant_data.engineering_area": 1,
            "applicant_data.application_status": 1,
            "applicant_data.submitted_at": 1,
          })
          .sort({ "applicant_data.submitted_at": -1 })
          .limit(limit)
          .lean();

        const list = applicants
          .map(
            (app) =>
              `- ${app.applicant_data?.name} (${app.applicant_data?.email}) | ${
                app.applicant_data?.engineering_area
              } | ${app.applicant_data?.application_status || "pending"}`
          )
          .join("\n");

        return `${applicants.length} applicants:\n${list}`;
      } catch (error) {
        return `error listing applicants: ${
          error instanceof Error ? error.message : "unknown error"
        }`;
      }
    }
  );
}

// Get statistics tool
export function createGetStatsTool() {
  return ai.defineTool(
    {
      name: "get_stats",
      description: "Get statistics about applicants and review progress",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        await connectDB();

        const completed = await Session.find({ state: "COMPLETED" }).lean();
        const stats = {
          total: completed.length,
          pending: completed.filter(
            (a) =>
              !a.applicant_data?.application_status ||
              a.applicant_data.application_status === "pending"
          ).length,
          accepted: completed.filter(
            (a) => a.applicant_data?.application_status === "accepted"
          ).length,
          rejected: completed.filter(
            (a) => a.applicant_data?.application_status === "rejected"
          ).length,
        };

        const approvalRate =
          stats.accepted + stats.rejected > 0
            ? (
                (stats.accepted / (stats.accepted + stats.rejected)) *
                100
              ).toFixed(1)
            : "0";

        return `${stats.total} total | ${stats.pending} pending | ${stats.accepted} accepted | ${stats.rejected} rejected. approval rate: ${approvalRate}%`;
      } catch (error) {
        return `error fetching stats: ${
          error instanceof Error ? error.message : "unknown error"
        }`;
      }
    }
  );
}

// Export all admin tools
export function createAdminTools() {
  return [
    createAdminReviewTool(),
    createGetApplicantTool(),
    createListApplicantsTool(),
    createGetStatsTool(),
  ];
}
