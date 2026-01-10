import mongoose, { Schema, Document, Model } from "mongoose";

// Onboarding states
export const ONBOARDING_STATES = [
  "AWAITING_EMAIL",
  "AWAITING_SECRET_PHRASE",
  "AWAITING_NAME",
  "AWAITING_WHATSAPP",
  "AWAITING_ENGINEERING_AREA",
  "AWAITING_SKILL_LEVEL",
  "AWAITING_IMPROVEMENT_GOALS",
  "AWAITING_CAREER_GOALS",
  "AWAITING_GITHUB",
  "AWAITING_LINKEDIN",
  "AWAITING_PORTFOLIO",
  "AWAITING_PROJECTS",
  "AWAITING_TIME_COMMITMENT",
  "AWAITING_LEARNING_STYLE",
  "AWAITING_TECH_FOCUS",
  "AWAITING_SUCCESS_DEFINITION",
  "COMPLETED",
] as const;

export type OnboardingState = (typeof ONBOARDING_STATES)[number];

// Message interface
export interface IMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: Date;
}

// Application status type
export type ApplicationStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "waitlisted";

// Applicant data interface
export interface IApplicantData {
  name?: string;
  email?: string;
  secret_phrase?: string;
  whatsapp?: string;
  engineering_area?: string;
  skill_level?: string;
  improvement_goals?: string;
  career_goals?: string;
  github?: string;
  linkedin?: string;
  portfolio?: string;
  projects?: string;
  time_commitment?: string;
  learning_style?: string;
  tech_focus?: string;
  success_definition?: string;
  submitted_at?: string;
  // Application review fields (admin-managed)
  application_status?: ApplicationStatus;
  review_notes?: string; // Admin notes/feedback
  reviewed_at?: string;
  reviewed_by?: string;
}

// Recovery state for tracking identity verification during secret phrase recovery
export interface IRecoveryState {
  email: string;
  verified_fields: string[];
  pending_field?: string;
  verification_score: number;
  attempts: number;
}

// Session document interface
export interface ISession extends Document {
  session_id: string;
  state: OnboardingState;
  messages: IMessage[];
  // Link to standalone Applicant model by email
  applicant_email?: string;
  // Legacy embedded data - for backward compatibility
  applicant_data: IApplicantData;
  processed_messages: string[];
  suggestions: string[];
  pending_verification?: {
    existing_session_id: string;
    existing_applicant_data: IApplicantData;
    existing_state: OnboardingState;
  };
  // Recovery flow state
  pending_recovery?: IRecoveryState;
  pending_action?: "logout" | "meme_war" | null;
  created_at: Date;
  updated_at: Date;
}

// Message schema
const MessageSchema = new Schema<IMessage>(
  {
    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

// Applicant data schema
const ApplicantDataSchema = new Schema<IApplicantData>(
  {
    name: String,
    email: String,
    secret_phrase: String,
    whatsapp: String,
    engineering_area: String,
    skill_level: String,
    improvement_goals: String,
    career_goals: String,
    github: String,
    linkedin: String,
    portfolio: String,
    projects: String,
    time_commitment: String,
    learning_style: String,
    tech_focus: String,
    success_definition: String,
    submitted_at: String,
    // Application review fields
    application_status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "waitlisted"],
      default: "pending",
    },
    review_notes: String,
    reviewed_at: String,
    reviewed_by: String,
  },
  { _id: false }
);

// Recovery state schema
const RecoveryStateSchema = new Schema<IRecoveryState>(
  {
    email: { type: String, required: true },
    verified_fields: { type: [String], default: [] },
    pending_field: String,
    verification_score: { type: Number, default: 0 },
    attempts: { type: Number, default: 0 },
  },
  { _id: false }
);

// Session schema
const SessionSchema = new Schema<ISession>(
  {
    session_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    state: {
      type: String,
      enum: ONBOARDING_STATES,
      default: "AWAITING_EMAIL",
    },
    messages: {
      type: [MessageSchema],
      default: [],
    },
    applicant_email: {
      type: String,
      index: { sparse: true },
    },
    applicant_data: {
      type: ApplicantDataSchema,
      default: {},
    },
    processed_messages: {
      type: [String],
      default: [],
    },
    suggestions: {
      type: [String],
      default: [],
    },
    pending_verification: {
      type: {
        existing_session_id: String,
        existing_applicant_data: ApplicantDataSchema,
        existing_state: String,
      },
      default: undefined,
    },
    pending_recovery: {
      type: RecoveryStateSchema,
      default: undefined,
    },
    pending_action: {
      type: String,
      enum: ["logout", "meme_war", null],
      default: null,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Index on email for lookups (sparse so null emails don't conflict)
SessionSchema.index({ "applicant_data.email": 1 }, { sparse: true });

// Delete cached model if it exists (needed when schema changes in development)
if (mongoose.models.Session) {
  delete mongoose.models.Session;
}

const Session: Model<ISession> = mongoose.model<ISession>(
  "Session",
  SessionSchema
);

export default Session;
