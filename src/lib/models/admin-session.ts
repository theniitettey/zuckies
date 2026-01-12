import mongoose, { Schema, Document, Model } from "mongoose";

// Message interface for admin chat
export interface IAdminMessage {
  role: "admin" | "assistant";
  content: string;
  timestamp: Date;
}

// Saved notes/memory for the admin assistant
export interface IAdminNote {
  key: string; // e.g., "applicant_john_email_com", "decision_reasoning", etc.
  value: string;
  created_at: Date;
  updated_at: Date;
}

// Admin session interface
export interface IAdminSession extends Document {
  admin_id: string; // Admin username or identifier
  session_id: string; // Unique session ID
  messages: IAdminMessage[];
  notes: IAdminNote[]; // Saved memories/notes
  created_at: Date;
  updated_at: Date;
}

// Admin session schema
const AdminSessionSchema = new Schema<IAdminSession>(
  {
    admin_id: { type: String, required: true },
    session_id: { type: String, required: true, unique: true },
    messages: [
      {
        role: { type: String, enum: ["admin", "assistant"], required: true },
        content: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    notes: [
      {
        key: { type: String, required: true },
        value: { type: String, required: true },
        created_at: { type: Date, default: Date.now },
        updated_at: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Index for faster lookups
AdminSessionSchema.index({ session_id: 1 });
AdminSessionSchema.index({ admin_id: 1 });

const AdminSession: Model<IAdminSession> =
  mongoose.models.AdminSession ||
  mongoose.model<IAdminSession>("AdminSession", AdminSessionSchema);

export default AdminSession;
