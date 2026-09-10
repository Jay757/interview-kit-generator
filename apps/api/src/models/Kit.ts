import mongoose, { Document, Schema, Model } from "mongoose";
import { KitStructure } from "../types/kit.js";

export interface IKitDocument extends Document, KitStructure {
  _id: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  status: "generating" | "completed" | "failed";
  createdAt: Date;
  updatedAt: Date;
}

const StateField = {
  type: String,
  enum: ["generated", "edited", "pinned"],
  default: "generated",
};

const KitSchema: Schema<IKitDocument> = new Schema<IKitDocument>(
  {
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["generating", "completed", "failed"],
      default: "completed",
      index: true,
    },
    source: {
      company: { type: String, default: "" },
      company_url: { type: String, default: "" },
      role: { type: String, default: "" },
      location: { type: String, default: "" },
      jd_chars: { type: Number, default: 0 },
      researched_at: { type: String, default: "" },
      pages_used: { type: [String], default: [] },
    },
    company_brief: {
      summary: { type: String, default: "" },
      what_they_do: { type: String, default: "" },
      sources: { type: [String], default: [] },
      state: StateField,
    },
    role: {
      title: { type: String, default: "" },
      seniority: { type: String, default: "" },
      responsibilities: { type: [String], default: [] },
      requirements: [
        {
          _id: false,
          id: { type: String, required: true },
          text: { type: String, required: true },
          kind: {
            type: String,
            enum: ["technical", "behavioural", "domain"],
            required: true,
          },
          priority: {
            type: String,
            enum: ["must", "nice"],
            required: true,
          },
          state: StateField,
        },
      ],
    },
    questions: [
      {
        _id: false,
        id: { type: String, required: true },
        requirement_ids: { type: [String], default: [] },
        category: {
          type: String,
          enum: ["technical", "behavioural", "system-design", "company-fit"],
          required: true,
        },
        prompt: { type: String, default: "" },
        answer_outline: { type: String, default: "" },
        difficulty: { type: Number, enum: [1, 2, 3], required: true },
        state: StateField,
      },
    ],
    flashcards: [
      {
        _id: false,
        id: { type: String, required: true },
        front: { type: String, default: "" },
        back: { type: String, default: "" },
        requirement_ids: { type: [String], default: [] },
        state: StateField,
      },
    ],
    schedule: {
      days_available: { type: Number, default: 5 },
      days: [
        {
          _id: false,
          day: { type: Number, required: true },
          focus: { type: String, default: "" },
          question_ids: { type: [String], default: [] },
          minutes: { type: Number, default: 60 },
        },
      ],
    },
    coverage: {
      uncovered_requirement_ids: { type: [String], default: [] },
      passes: { type: Number, default: 1 },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete (ret as any).__v;
        return ret;
      },
    },
  }
);

export const Kit: Model<IKitDocument> =
  mongoose.models.Kit || mongoose.model<IKitDocument>("Kit", KitSchema);
