import mongoose, { Schema, Document, Model } from "mongoose";

// Application status type
export type ApplicationStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "waitlisted";

// Applicant document interface - standalone model for application data
export interface IApplicant extends Document {
  email: string; // Primary identifier - unique and immutable
  secret_phrase_hash: string; // Hashed secret phrase for verification
  name?: string;
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
  // Application status
  submitted_at?: string;
  application_status: ApplicationStatus;
  review_notes?: string;
  reviewed_at?: string;
  reviewed_by?: string;
  // Recovery tracking
  recovery_attempts: number;
  last_recovery_attempt?: Date;
  // Timestamps
  created_at: Date;
  updated_at: Date;
}

// Fields that can be used for identity verification during recovery
export const VERIFIABLE_FIELDS = [
  { key: "github", label: "GitHub username/URL", weight: 3 },
  { key: "linkedin", label: "LinkedIn profile", weight: 3 },
  { key: "portfolio", label: "portfolio website", weight: 3 },
  { key: "whatsapp", label: "WhatsApp number", weight: 2 },
  { key: "name", label: "full name", weight: 1 },
  { key: "engineering_area", label: "engineering focus area", weight: 1 },
  { key: "skill_level", label: "skill level", weight: 1 },
] as const;

// Minimum verification score needed (weighted)
export const MIN_VERIFICATION_SCORE = 5;

const ApplicantSchema = new Schema<IApplicant>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    secret_phrase_hash: {
      type: String,
      required: true,
    },
    name: String,
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
    application_status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "waitlisted"],
      default: "pending",
    },
    review_notes: String,
    reviewed_at: String,
    reviewed_by: String,
    recovery_attempts: {
      type: Number,
      default: 0,
    },
    last_recovery_attempt: Date,
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

// Index on github for recovery lookups
ApplicantSchema.index({ github: 1 }, { sparse: true });
ApplicantSchema.index({ linkedin: 1 }, { sparse: true });

// Delete cached model if it exists
if (mongoose.models.Applicant) {
  delete mongoose.models.Applicant;
}

const Applicant: Model<IApplicant> = mongoose.model<IApplicant>(
  "Applicant",
  ApplicantSchema
);

export default Applicant;
