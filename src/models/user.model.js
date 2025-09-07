import mongoose, { Schema } from "mongoose";
import { connectMongo } from "../db/mongoose.js";

// Ensure connection is established for model usage (ESM supports top-level await)
await connectMongo();

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    mobile: { type: String, required: true },
    passwordHash: { type: String, required: true },
    role: { type: String, default: "user" },
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);

export async function findUserByEmail(email) {
  return User.findOne({ email: email.toLowerCase() }).lean();
}

export async function createUser({
  name,
  email,
  mobile,
  passwordHash,
  role = "user",
}) {
  const lowerEmail = email.toLowerCase();
  const existing = await User.findOne({ email: lowerEmail }).lean();
  if (existing) throw new Error("You already have an account. Please login.");
  const doc = await User.create({
    name,
    email: lowerEmail,
    mobile,
    passwordHash,
    role,
  });
  return doc.toObject();
}

export async function updateUserPasswordByEmail(email, passwordHash) {
  const lowerEmail = email.toLowerCase();
  const res = await User.updateOne(
    { email: lowerEmail },
    { $set: { passwordHash } }
  );
  return res.modifiedCount > 0;
}

// List all users excluding sensitive fields
export async function listUsers() {
  // Exclude passwordHash; return lean objects for performance
  return User.find({}, "-passwordHash").lean();
}
