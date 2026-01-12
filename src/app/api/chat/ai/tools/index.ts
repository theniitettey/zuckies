import { type ISession } from "@/lib/models/session";
import { createEngagementTools } from "./engagement";
import { createAuthTools } from "./auth";
import { createMemoryTools } from "./memory";
import { createOnboardingTools } from "./onboarding";
import { createProfileTools } from "./profile";
import { createRecoveryTools } from "./recovery";
import { createRoastTools } from "./roast";
import { createFetchTools } from "./fetch";

export function createTools(
  session: ISession,
  saveSession: () => Promise<void>,
  markPendingSave: () => void,
  authContext: { token?: string; tokenEmail?: string; sessionId: string }
) {
  const authTools = createAuthTools(
    authContext,
    session,
    saveSession,
    markPendingSave
  );
  const onboardingTools = createOnboardingTools(session, markPendingSave);
  const profileTools = createProfileTools(session, markPendingSave);
  const recoveryTools = createRecoveryTools(session, markPendingSave);
  const engagementTools = createEngagementTools(
    session,
    saveSession,
    markPendingSave
  );
  const memoryTools = createMemoryTools(session, markPendingSave);
  const roastTools = createRoastTools(session);
  const fetchTools = createFetchTools();

  return [
    ...authTools,
    ...onboardingTools,
    ...profileTools,
    ...recoveryTools,
    ...engagementTools,
    ...memoryTools,
    ...roastTools,
    ...fetchTools,
  ];
}
