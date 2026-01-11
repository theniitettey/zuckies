import type { OnboardingState } from "@/lib/models/session";

// Welcome message
export const WELCOME_MESSAGE = `yo! 👋

i'm the onboarding ai for **michael perry tettey's** mentorship program - trained to vibe like the mentor himself.

![focused programmer](https://github.com/MastooraTurkmen/MastooraTurkmen/assets/132576850/ddec8b62-1039-42d3-a361-46dcc1338b07)

let's get started. first, *drop your email* - this is how we'll identify you if you come back later.`;

// Default suggestions for fallback
export const DEFAULT_SUGGESTIONS: Record<OnboardingState, string[]> = {
  AWAITING_EMAIL: [],
  AWAITING_SECRET_PHRASE: [],
  AWAITING_NAME: [],
  AWAITING_WHATSAPP: [],
  AWAITING_ENGINEERING_AREA: ["frontend", "backend", "full stack", "mobile"],
  AWAITING_SKILL_LEVEL: ["beginner", "intermediate", "advanced"],
  AWAITING_IMPROVEMENT_GOALS: ["system design", "clean code", "testing"],
  AWAITING_CAREER_GOALS: ["land first job", "get promoted", "freelance"],
  AWAITING_GITHUB: ["don't have one", "will share later"],
  AWAITING_LINKEDIN: ["don't have one", "prefer not to share"],
  AWAITING_PORTFOLIO: ["no portfolio yet", "working on it"],
  AWAITING_PROJECTS: ["todo app", "portfolio", "nothing yet"],
  AWAITING_TIME_COMMITMENT: ["5 hours/week", "10 hours/week", "15+ hours/week"],
  AWAITING_LEARNING_STYLE: ["hands-on", "videos", "reading docs"],
  AWAITING_TECH_FOCUS: ["javascript", "python", "rust", "go"],
  AWAITING_SUCCESS_DEFINITION: [
    "ship projects",
    "get hired",
    "build confidence",
  ],
  COMPLETED: [
    "⭐ rate my experience",
    "check my status",
    "tell me about the program",
    "who is the mentor?",
  ],
  FREE_CHAT: [
    "let's have a meme war",
    "help me with some code",
    "tell me a joke",
    "what can you help me with?",
    "check my status",
  ],
};
