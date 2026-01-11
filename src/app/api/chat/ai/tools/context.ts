import { type ISession } from "@/lib/models/session";

export interface ToolContext {
  session: ISession;
  saveSession: () => Promise<void>;
  markPendingSave: () => void;
  authContext: { token?: string; tokenEmail?: string; sessionId: string };
}
