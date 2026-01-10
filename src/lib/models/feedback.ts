import mongoose, { Schema, Document, Model } from "mongoose";

// Feedback document interface
export interface IFeedback extends Document {
  session_id: string;
  email?: string;
  name?: string;
  // Rating 1-5 stars
  rating: number;
  // What they liked or general feedback
  feedback?: string;
  // Suggestions for improvement
  suggestions?: string;
  // Which part of the experience
  category?: "onboarding" | "mentoring" | "ui" | "general";
  // Metadata
  onboarding_state?: string;
  created_at: Date;
}

const FeedbackSchema = new Schema<IFeedback>(
  {
    session_id: {
      type: String,
      required: true,
      index: true,
    },
    email: {
      type: String,
      sparse: true,
      index: true,
    },
    name: String,
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    feedback: String,
    suggestions: String,
    category: {
      type: String,
      enum: ["onboarding", "mentoring", "ui", "general"],
      default: "general",
    },
    onboarding_state: String,
    created_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
  }
);

// Index for analytics queries
FeedbackSchema.index({ rating: 1, created_at: -1 });
FeedbackSchema.index({ category: 1, created_at: -1 });

// Delete cached model if it exists
if (mongoose.models.Feedback) {
  delete mongoose.models.Feedback;
}

const Feedback: Model<IFeedback> = mongoose.model<IFeedback>(
  "Feedback",
  FeedbackSchema
);

export default Feedback;
