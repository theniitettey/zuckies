import type { OnboardingState } from "@/lib/models/session";

// Fallback messages when AI fails to generate
export function generateStateFallback(
  state: OnboardingState,
  name?: string,
  isReturningUser?: boolean
): string {
  const fallbacks: Record<OnboardingState, string> = {
    AWAITING_EMAIL: "drop your email so we can get started! 📧",
    AWAITING_SECRET_PHRASE: isReturningUser
      ? `welcome back${
          name ? ` ${name}` : ""
        }! 👋 enter your secret phrase to verify it's you.`
      : `nice! now choose a secret phrase - something memorable that only you know. this is like your password to come back later. think of something fun like "pizza is life" 🤫`,
    AWAITING_NAME: "got it! what should i call you?",
    AWAITING_WHATSAPP: `cool${
      name ? ` ${name}` : ""
    }! drop your whatsapp number (with country code like +233) - we use it for the mentorship group.`,
    AWAITING_ENGINEERING_AREA:
      "what's your engineering focus? frontend, backend, full stack, mobile?",
    AWAITING_SKILL_LEVEL:
      "how would you rate your skill level? beginner, intermediate, or advanced?",
    AWAITING_IMPROVEMENT_GOALS:
      "what do you want to get better at? system design, clean code, testing, etc?",
    AWAITING_CAREER_GOALS:
      "where do you see yourself career-wise? landing first job, getting promoted, freelancing?",
    AWAITING_GITHUB:
      "got a github? drop the link or username (or say skip if you don't have one)",
    AWAITING_LINKEDIN: "linkedin? same deal - link, username, or skip",
    AWAITING_PORTFOLIO: "portfolio site? share if you have one, or skip",
    AWAITING_PROJECTS: "what have you built so far? even small projects count!",
    AWAITING_TIME_COMMITMENT:
      "how many hours per week can you realistically dedicate to this?",
    AWAITING_LEARNING_STYLE:
      "how do you learn best? hands-on coding, videos, reading docs?",
    AWAITING_TECH_FOCUS:
      "what tech do you want to focus on? javascript, python, rust, etc?",
    AWAITING_SUCCESS_DEFINITION:
      "last one! how will you know you've succeeded in this program?",
    COMPLETED: `application submitted${name ? ` ${name}` : ""}! 🎉 

your application is now **under review**. the mentor will review it and get back to you.

now entering free chat mode! you can:
- ask me anything about the program
- check your application status anytime (just say "check my status")
- have a meme war 🎭
- get coding help
- tell me more about yourself

---

before you go - how was the onboarding experience? rate it 1-5 stars and share any thoughts or suggestions. your feedback helps make this better! ✨`,
    FREE_CHAT: `hey${name ? ` ${name}` : ""}! 👋 

i'm here to chat, help with code, have meme wars, or whatever you need. what's on your mind?`,
  };
  return fallbacks[state] || "let's continue! what's your answer?";
}
