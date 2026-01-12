import ai from "@/app/api/chat/ai/config";
import { z } from "genkit";

/**
 * Admin Tools
 *
 * Tools for admin dashboard to manage applications and make review decisions.
 * These tools work with applicant data passed from the route handler.
 * No redundant DB connections - the route handler manages all database access.
 *
 * Tools included:
 * - list_applicants: Filter and display applicants from provided data
 * - get_applicant: Get detailed profile from provided applicants list
 * - update_status: Change application status (requires route handler callback)
 * - get_dashboard_stats: Compute metrics from provided applicants
 * - save_note: Save important information to memory for later recall
 * - get_notes: Retrieve saved notes from memory
 *
 * @module admin/tools
 */

export function createAdminTools(
  applicants: any[],
  onStatusChange?: (sessionId: string, status: string) => Promise<void>,
  onSaveNote?: (key: string, value: string) => Promise<void>,
  onGetNotes?: (key?: string) => Promise<string>
) {
  // List applicants with filtering
  const listApplicantsTool = ai.defineTool(
    {
      name: "list_applicants",
      description:
        "Search and filter applicants from the dashboard. filter by status (pending, accepted, rejected), search by name/email, or list all applicants.",
      inputSchema: z.object({
        status: z
          .enum(["all", "pending", "accepted", "rejected"])
          .optional()
          .describe("Filter by application status"),
        search: z
          .string()
          .optional()
          .describe("Search by name or email (case-insensitive)"),
        limit: z
          .number()
          .optional()
          .default(15)
          .describe("Max results to return (max 50)"),
      }),
      outputSchema: z.string(),
    },
    async (input) => {
      try {
        const limit = Math.min(input.limit || 15, 50);

        // Filter applicants from provided data
        let filtered = applicants.filter((app) => app.state === "COMPLETED");

        // Status filter
        if (input.status && input.status !== "all") {
          filtered = filtered.filter(
            (app) =>
              (app.applicant_data?.application_status || "pending") ===
              input.status
          );
        }

        // Search filter
        if (input.search) {
          const searchLower = input.search.toLowerCase();
          filtered = filtered.filter((app) => {
            const name = app.applicant_data?.name || "";
            const email = app.applicant_data?.email || "";
            return (
              name.toLowerCase().includes(searchLower) ||
              email.toLowerCase().includes(searchLower)
            );
          });
        }

        // Limit results
        const results = filtered.slice(0, limit);

        if (results.length === 0) {
          return "no applicants found.";
        }

        const list = results
          .map((app, idx) => {
            const status = app.applicant_data?.application_status || "pending";
            const emoji =
              status === "accepted"
                ? "✅"
                : status === "rejected"
                ? "❌"
                : "⏳";
            return `${idx + 1}. ${app.applicant_data?.name} (${
              app.applicant_data?.email
            }) | ${app.applicant_data?.engineering_area} | ${emoji} ${status}`;
          })
          .join("\n");

        return `${results.length} applicants (${filtered.length} total match):\n${list}`;
      } catch (error) {
        return `error listing applicants: ${
          error instanceof Error ? error.message : "unknown error"
        }`;
      }
    }
  );

  // Get detailed applicant info
  const getApplicantTool = ai.defineTool(
    {
      name: "get_applicant",
      description:
        "Get detailed profile information for a specific applicant. provide either email or name to search.",
      inputSchema: z.object({
        email: z.string().optional().describe("Applicant email address"),
        name: z
          .string()
          .optional()
          .describe("Applicant name (searches for partial match)"),
      }),
      outputSchema: z.string(),
    },
    async (input) => {
      try {
        if (!input.email && !input.name) {
          return "provide either email or name";
        }

        // Search from provided applicants data
        let app = null;

        if (input.email) {
          app = applicants.find(
            (a) =>
              a.applicant_data?.email?.toLowerCase() ===
              input.email?.toLowerCase()
          )?.applicant_data;
        } else if (input.name) {
          const nameLower = input.name.toLowerCase();
          app = applicants.find((a) =>
            a.applicant_data?.name?.toLowerCase().includes(nameLower)
          )?.applicant_data;
        }

        if (!app) {
          return "applicant not found.";
        }

        const info = `
**${app.name}** (${app.email})
status: ${app.application_status || "pending"}
area: ${app.engineering_area}
level: ${app.skill_level}
goals: ${app.career_goals}
github: ${app.github || "not provided"}
linkedin: ${app.linkedin || "not provided"}
portfolio: ${app.portfolio || "not provided"}
time commitment: ${app.time_commitment}
submitted: ${app.submitted_at}
`;

        if (app.review_notes) {
          return info + `notes: ${app.review_notes}`;
        }

        return info;
      } catch (error) {
        return `error fetching applicant: ${
          error instanceof Error ? error.message : "unknown error"
        }`;
      }
    }
  );

  // Update application status
  const updateStatusTool = ai.defineTool(
    {
      name: "update_status",
      description:
        "Change an applicant's application status to pending, accepted, or rejected. allows moving applicants backward (e.g., from accepted back to pending for re-review).",
      inputSchema: z.object({
        email: z.string().describe("Applicant email address to update"),
        status: z
          .enum(["pending", "accepted", "rejected"])
          .describe("New status to set"),
        notes: z
          .string()
          .optional()
          .describe("Optional review notes explaining the decision"),
      }),
      outputSchema: z.string(),
    },
    async (input) => {
      try {
        if (!onStatusChange) {
          return "status update not available in this context";
        }

        // Find the applicant
        const applicant = applicants.find(
          (a) =>
            a.applicant_data?.email?.toLowerCase() ===
            input.email?.toLowerCase()
        );

        if (!applicant) {
          return `applicant with email ${input.email} not found`;
        }

        // Call the update handler
        await onStatusChange(applicant.session_id, input.status);

        return `✅ ${applicant.applicant_data?.name}'s application has been ${
          input.status
        }${input.notes ? ` with note: ${input.notes}` : ""}`;
      } catch (error) {
        return `error updating status: ${
          error instanceof Error ? error.message : "unknown error"
        }`;
      }
    }
  );

  // Get dashboard stats
  const getStatsTool = ai.defineTool(
    {
      name: "get_dashboard_stats",
      description:
        "Get overview statistics about applications: total, pending, accepted, rejected, and approval rate.",
      inputSchema: z.object({}),
      outputSchema: z.string(),
    },
    async () => {
      try {
        const completed = applicants.filter((a) => a.state === "COMPLETED");
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

        return `
dashboard stats:
- total: ${stats.total}
- pending: ${stats.pending}
- accepted: ${stats.accepted}
- rejected: ${stats.rejected}
- approval rate: ${approvalRate}%
        `.trim();
      } catch (error) {
        return `error fetching stats: ${
          error instanceof Error ? error.message : "unknown error"
        }`;
      }
    }
  );

  // Save note/memory
  const saveNoteTool = ai.defineTool(
    {
      name: "save_note",
      description:
        "Save important information to memory for later recall. use this to remember decisions, reasoning, patterns, or any important context about applicants or review processes.",
      inputSchema: z.object({
        key: z
          .string()
          .describe(
            "Unique identifier for this note (e.g., 'applicant_john_concerns', 'batch_2024_standards')"
          ),
        value: z.string().describe("The information to save"),
      }),
      outputSchema: z.string(),
    },
    async (input) => {
      try {
        if (!onSaveNote) {
          return "note saving not available in this context";
        }

        await onSaveNote(input.key, input.value);
        return `✅ saved note: ${input.key}`;
      } catch (error) {
        return `error saving note: ${
          error instanceof Error ? error.message : "unknown error"
        }`;
      }
    }
  );

  // Get notes/memory
  const getNotesTool = ai.defineTool(
    {
      name: "get_notes",
      description:
        "Retrieve saved notes from memory. optionally filter by key prefix to find related notes.",
      inputSchema: z.object({
        key: z
          .string()
          .optional()
          .describe(
            "Optional: specific note key or prefix to search (e.g., 'applicant_' to get all applicant notes)"
          ),
      }),
      outputSchema: z.string(),
    },
    async (input) => {
      try {
        if (!onGetNotes) {
          return "note retrieval not available in this context";
        }

        const notes = await onGetNotes(input.key);
        return notes || "no notes found";
      } catch (error) {
        return `error retrieving notes: ${
          error instanceof Error ? error.message : "unknown error"
        }`;
      }
    }
  );

  return [
    listApplicantsTool,
    getApplicantTool,
    updateStatusTool,
    getStatsTool,
    saveNoteTool,
    getNotesTool,
  ];
}
