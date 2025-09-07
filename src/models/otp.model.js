import mongoose, { Schema } from "mongoose";
import { connectMongo } from "../db/mongoose.js";

// Ensure connection is established for model usage
await connectMongo();

const otpSchema = new Schema(
  {
    name: { type: String },
    email: { type: String, required: true, lowercase: true, index: true },
    mobile: { type: String, required: true },
    code: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "used", "expired"],
      default: "pending",
      index: true,
    },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

const Otp = mongoose.models.Otp || mongoose.model("Otp", otpSchema);

export async function createOtp({ name, email, mobile, code, expiresAt }) {
  const doc = await Otp.create({
    name,
    email: email.toLowerCase(),
    mobile,
    code,
    status: "pending",
    expiresAt,
  });
  return doc.toObject();
}

export async function getLatestPendingOtp({ email }) {
  return Otp.findOne({ email: email.toLowerCase(), status: "pending" })
    .sort({ createdAt: -1 })
    .lean();
}

export async function markOtpUsed(id) {
  await Otp.updateOne({ _id: id }, { $set: { status: "used" } });
  return { _id: id, status: "used" };
}

export async function expireOtp(id) {
  await Otp.updateOne({ _id: id }, { $set: { status: "expired" } });
  return { _id: id, status: "expired" };
}
