import { genkit, z } from "genkit";
import { googleAI } from "@genkit-ai/google-genai";

// Shared AI instance for tools and route
const ai = genkit({
  plugins: [googleAI()],
});

const saveDataSchema = z.object({
  email: z.string().optional(),
  name: z.string().optional(),
  secret_phrase: z.string().optional(),
  whatsapp: z.string().optional(),
  engineering_area: z.string().optional(),
  skill_level: z.string().optional(),
  improvement_goals: z.string().optional(),
  career_goals: z.string().optional(),
  github: z.string().optional(),
  linkedin: z.string().optional(),
  portfolio: z.string().optional(),
  projects: z.string().optional(),
  time_commitment: z.string().optional(),
  learning_style: z.string().optional(),
  tech_focus: z.string().optional(),
  success_definition: z.string().optional(),
});

export default ai;
export { saveDataSchema };
