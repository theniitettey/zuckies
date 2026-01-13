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
 * - query_db: Flexible MongoDB CRUD operations (soft deletes only)
 *
 * @module admin/tools
 */

// Query/CRUD options for the db callback
export interface DbOperationOptions {
  operation: "read" | "create" | "update" | "delete";
  collection: "applicants" | "feedback" | "sessions";
  // For read operations
  filter?: Record<string, any>;
  projection?: Record<string, 0 | 1>;
  sort?: Record<string, 1 | -1>;
  limit?: number;
  skip?: number;
  // For create operations
  document?: Record<string, any>;
  // For update operations
  update?: Record<string, any>;
  // For delete (soft) - filter is used to find documents
}

export interface DbOperationResult {
  success: boolean;
  data?: any[];
  modifiedCount?: number;
  insertedId?: string;
  error?: string;
}

export function createAdminTools(
  applicants: any[],
  onStatusChange?: (email: string, status: string) => Promise<void>,
  onSaveNote?: (key: string, value: string) => Promise<void>,
  onGetNotes?: (key?: string) => Promise<string>,
  onDbOperation?: (options: DbOperationOptions) => Promise<DbOperationResult>
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

        // Filter applicants from provided data (already filtered by submitted_at in route)
        let filtered = [...applicants];

        // Status filter
        if (input.status && input.status !== "all") {
          filtered = filtered.filter(
            (app) => (app.application_status || "pending") === input.status
          );
        }

        // Search filter
        if (input.search) {
          const searchLower = input.search.toLowerCase();
          filtered = filtered.filter((app) => {
            const name = app.name || "";
            const email = app.email || "";
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
            const status = app.application_status || "pending";
            const emoji =
              status === "accepted"
                ? "✅"
                : status === "rejected"
                ? "❌"
                : "⏳";
            return `${idx + 1}. ${app.name} (${app.email}) | ${
              app.engineering_area
            } | ${emoji} ${status}`;
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
            (a) => a.email?.toLowerCase() === input.email?.toLowerCase()
          );
        } else if (input.name) {
          const nameLower = input.name.toLowerCase();
          app = applicants.find((a) =>
            a.name?.toLowerCase().includes(nameLower)
          );
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
          (a) => a.email?.toLowerCase() === input.email?.toLowerCase()
        );

        if (!applicant) {
          return `applicant with email ${input.email} not found`;
        }

        // Call the update handler with email
        await onStatusChange(applicant.email, input.status);

        return `✅ ${applicant.name}'s application has been ${input.status}${
          input.notes ? ` with note: ${input.notes}` : ""
        }`;
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
        // Applicants are already filtered by submitted_at in route
        const stats = {
          total: applicants.length,
          pending: applicants.filter(
            (a) => !a.application_status || a.application_status === "pending"
          ).length,
          accepted: applicants.filter(
            (a) => a.application_status === "accepted"
          ).length,
          rejected: applicants.filter(
            (a) => a.application_status === "rejected"
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

  // Flexible database CRUD tool
  const queryDbTool = ai.defineTool(
    {
      name: "query_db",
      description: `Execute flexible MongoDB CRUD operations on the database. Supports read, create, update, and soft delete.

Available collections:
- applicants: User applications (fields: email, name, engineering_area, skill_level, career_goals, github, linkedin, portfolio, time_commitment, application_status, submitted_at, reviewed_at, deleted_at)
- feedback: User feedback submissions (fields: session_id, rating, feedback, suggestions, category, created_at, deleted_at)
- sessions: Chat sessions with full message content (fields: email, session_id, messages[{role, content, timestamp}], started_at, last_interaction, deleted_at)

Operations:
1. READ: Query documents with filters, sorting, pagination. Sessions include full message content by default.
2. CREATE: Insert new documents (use sparingly, mainly for feedback/notes)
3. UPDATE: Modify existing documents matching a filter
4. DELETE: Soft delete - sets deleted_at timestamp (documents can be restored)

READ options:
- raw_json=true: Returns full raw JSON data (useful for detailed inspection)
- Sessions automatically show message content (truncated to 500 chars each)
- Use fields parameter to select specific fields

Filter examples (JSON string):
- Exact match: {"application_status": "pending"}
- Regex: {"name": {"$regex": "john", "$options": "i"}}
- Comparison: {"submitted_at": {"$gte": "2024-01-01"}}
- In list: {"skill_level": {"$in": ["intermediate", "advanced"]}}
- Exists: {"github": {"$exists": true}}
- And/Or: {"$and": [...]} or {"$or": [...]}

Update examples (JSON string):
- Set fields: {"$set": {"application_status": "accepted", "review_notes": "strong candidate"}}
- Increment: {"$inc": {"recovery_attempts": 1}}
- Unset: {"$unset": {"temporary_field": ""}}`,
      inputSchema: z.object({
        operation: z
          .enum(["read", "create", "update", "delete"])
          .describe("CRUD operation to perform"),
        collection: z
          .enum(["applicants", "feedback", "sessions"])
          .describe("Which collection to operate on"),
        filter_json: z
          .string()
          .optional()
          .describe(
            'MongoDB filter as JSON string for read/update/delete. Example: \'{"email": "user@example.com"}\''
          ),
        document_json: z
          .string()
          .optional()
          .describe(
            'For CREATE: document to insert as JSON string. Example: \'{"session_id": "abc", "rating": 5, "feedback": "great!"}\''
          ),
        update_json: z
          .string()
          .optional()
          .describe(
            'For UPDATE: MongoDB update operations as JSON string. Example: \'{"$set": {"application_status": "accepted"}}\''
          ),
        fields: z
          .array(z.string())
          .optional()
          .describe("For READ: fields to include in results"),
        sort_by: z.string().optional().describe("For READ: field to sort by"),
        sort_order: z
          .enum(["asc", "desc"])
          .optional()
          .describe("For READ: sort direction (default: desc)"),
        limit: z
          .number()
          .optional()
          .describe("For READ: max results (default 20, max 100)"),
        skip: z
          .number()
          .optional()
          .describe("For READ: results to skip for pagination"),
        raw_json: z
          .boolean()
          .optional()
          .describe(
            "For READ: if true, returns full raw JSON output instead of formatted summary. Use this to read full session messages, detailed applicant data, etc."
          ),
      }),
      outputSchema: z.string(),
    },
    async (input) => {
      try {
        if (!onDbOperation) {
          return "database operations not available in this context";
        }

        // Parse filter from JSON string
        let safeFilter: Record<string, any> = {};
        if (input.filter_json && typeof input.filter_json === "string") {
          try {
            safeFilter = JSON.parse(input.filter_json);
          } catch (parseError) {
            return `invalid filter JSON: ${
              parseError instanceof Error ? parseError.message : "parse error"
            }`;
          }
        }

        // Handle READ operation
        if (input.operation === "read") {
          const projection: Record<string, 1> | undefined =
            input.fields && input.fields.length > 0
              ? input.fields.reduce(
                  (acc, field) => ({ ...acc, [field]: 1 }),
                  {} as Record<string, 1>
                )
              : undefined;

          const sort: Record<string, 1 | -1> | undefined =
            input.sort_by && typeof input.sort_by === "string"
              ? { [input.sort_by]: input.sort_order === "asc" ? 1 : -1 }
              : undefined;

          const result = await onDbOperation({
            operation: "read",
            collection: input.collection,
            filter: safeFilter,
            projection,
            sort,
            limit: Math.min(input.limit ?? 20, 100),
            skip: input.skip ?? 0,
          });

          if (!result.success) {
            return `read error: ${result.error}`;
          }

          const results = result.data || [];
          if (results.length === 0) {
            return `no results found in ${input.collection}.`;
          }

          // If raw_json is requested, return full data
          if (input.raw_json) {
            return `${results.length} results (raw JSON):\n${JSON.stringify(
              results,
              null,
              2
            )}`;
          }

          // Format results based on collection type
          if (input.collection === "applicants") {
            const formatted = results.map((doc, idx) => {
              const status = doc.application_status || "pending";
              const emoji =
                status === "accepted"
                  ? "✅"
                  : status === "rejected"
                  ? "❌"
                  : "⏳";

              if (input.fields?.length) {
                const fieldValues = input.fields
                  .map((f) => `${f}: ${doc[f] ?? "N/A"}`)
                  .join(" | ");
                return `${idx + 1}. ${fieldValues}`;
              }

              return `${idx + 1}. ${doc.name || "unnamed"} (${doc.email}) | ${
                doc.engineering_area || "N/A"
              } | ${emoji} ${status}`;
            });
            return `${
              results.length
            } results from applicants:\n${formatted.join("\n")}`;
          }

          if (input.collection === "feedback") {
            const formatted = results.map((doc, idx) => {
              return `${idx + 1}. rating: ${doc.rating}/5 | "${
                doc.feedback || "no feedback"
              }" | ${doc.created_at || "unknown date"}`;
            });
            return `${results.length} feedback entries:\n${formatted.join(
              "\n"
            )}`;
          }

          if (input.collection === "sessions") {
            // Show session details including message content
            const formatted = results.map((doc, idx) => {
              const messages = doc.messages || [];
              const msgCount = messages.length;

              // Format messages for display
              const messageList = messages
                .map((msg: any, msgIdx: number) => {
                  const role = msg.role === "user" ? "👤" : "🤖";
                  const content = msg.content?.substring(0, 500) || "[empty]";
                  const truncated = msg.content?.length > 500 ? "..." : "";
                  return `  ${role} ${content}${truncated}`;
                })
                .join("\n");

              return `**Session ${idx + 1}**: ${
                doc.email || "anonymous"
              } | ${msgCount} messages | last: ${
                doc.last_interaction || "unknown"
              }\n${messageList}`;
            });
            return `${results.length} sessions:\n\n${formatted.join(
              "\n\n---\n\n"
            )}`;
          }

          return `${results.length} results:\n${JSON.stringify(
            results,
            null,
            2
          )}`;
        }

        // Handle CREATE operation
        if (input.operation === "create") {
          if (!input.document_json) {
            return "create operation requires document_json parameter";
          }

          let document: Record<string, any>;
          try {
            document = JSON.parse(input.document_json);
          } catch (parseError) {
            return `invalid document JSON: ${
              parseError instanceof Error ? parseError.message : "parse error"
            }`;
          }

          const result = await onDbOperation({
            operation: "create",
            collection: input.collection,
            document,
          });

          if (!result.success) {
            return `create error: ${result.error}`;
          }

          return `✅ created document in ${input.collection}${
            result.insertedId ? ` (id: ${result.insertedId})` : ""
          }`;
        }

        // Handle UPDATE operation
        if (input.operation === "update") {
          if (!input.update_json) {
            return "update operation requires update_json parameter";
          }

          if (Object.keys(safeFilter).length === 0) {
            return "update operation requires filter_json to identify documents to update (safety measure)";
          }

          let update: Record<string, any>;
          try {
            update = JSON.parse(input.update_json);
          } catch (parseError) {
            return `invalid update JSON: ${
              parseError instanceof Error ? parseError.message : "parse error"
            }`;
          }

          const result = await onDbOperation({
            operation: "update",
            collection: input.collection,
            filter: safeFilter,
            update,
          });

          if (!result.success) {
            return `update error: ${result.error}`;
          }

          return `✅ updated ${result.modifiedCount || 0} document(s) in ${
            input.collection
          }`;
        }

        // Handle DELETE (soft) operation
        if (input.operation === "delete") {
          if (Object.keys(safeFilter).length === 0) {
            return "delete operation requires filter_json to identify documents to delete (safety measure)";
          }

          const result = await onDbOperation({
            operation: "delete",
            collection: input.collection,
            filter: safeFilter,
          });

          if (!result.success) {
            return `delete error: ${result.error}`;
          }

          return `✅ soft deleted ${result.modifiedCount || 0} document(s) in ${
            input.collection
          } (can be restored by unsetting deleted_at)`;
        }

        return "unknown operation";
      } catch (error) {
        return `db operation error: ${
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
    queryDbTool,
  ];
}
