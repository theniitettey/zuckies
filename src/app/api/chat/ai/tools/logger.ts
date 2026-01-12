export function logToolExecution(name: string, input: any) {
  const summary = summarizeInput(input);
  const suffix = summary ? ` ${summary}` : "";
  console.log(`🛠️ Tool executing: ${name}${suffix}`);
}

function summarizeInput(input: any): string {
  if (input === null || input === undefined) return "";
  if (typeof input === "string") return input;
  if (typeof input === "object") {
    const preferredKeys = [
      "handle",
      "url",
      "query",
      "email",
      "id",
      "token",
      "sessionId",
      "state",
      "action",
      "phrase",
      "message",
    ];
    for (const key of preferredKeys) {
      const value = (input as Record<string, unknown>)[key];
      if (typeof value === "string" && value.trim().length > 0) return value;
    }
    try {
      return JSON.stringify(input);
    } catch (err) {
      return String(input);
    }
  }
  return String(input);
}
