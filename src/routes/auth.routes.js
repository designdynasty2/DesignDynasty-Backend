import express from "express";
import Joi from "joi";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendEmail } from "../utils/email.js";
import {
  createOtp,
  getLatestPendingOtp,
  markOtpUsed,
  expireOtp,
} from "../models/otp.model.js";
import {
  createUser,
  findUserByEmail,
  updateUserPasswordByEmail,
} from "../models/user.model.js";

const router = express.Router();

// Helpers
const otpSchema = Joi.object({
  email: Joi.string().email().required(),
  mobile: Joi.string().min(5).max(20).required(),
});

const registerSchema = otpSchema.keys({
  name: Joi.string().min(2).max(100).required(),
});

const verifySchema = Joi.object({
  email: Joi.string().email().required(),
  otp: Joi.string().length(6).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});
const contactSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  service: Joi.string().min(2).max(100).required(),
  message: Joi.string().min(5).max(1000).required(),
});
function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
}

function generatePassword() {
  return uuidv4().slice(0, 12).replace(/-/g, "");
}

// 1) Start registration: name, email, mobile → send OTP to email (valid 5 minutes)
router.post("/register", async (req, res) => {
  try {
    const { value, error } = registerSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { name, email, mobile } = value;

    // Prevent duplicate email
    const existing = await findUserByEmail(email);
    if (existing)
      return res
        .status(409)
        .json({ error: "You already have an account. Please login." });

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    await createOtp({ name, email, mobile, code, expiresAt });

    // Email OTP
    await sendEmail({
      to: email,
      subject: "Your registration OTP",
      text: `Your OTP is ${code}. It expires in 5 minutes.`,
      html: `<p>Your OTP is <b>${code}</b>. It expires in 5 minutes.</p>`,
    });

    return res.json({ message: "OTP sent to email" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to start registration" });
  }
});

// 2) Verify OTP → if valid, create user and send password to email
router.post("/verify-otp", async (req, res) => {
  try {
    const { value, error } = verifySchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { email, otp } = value;
    const record = await getLatestPendingOtp({ email });

    if (!record) return res.status(404).json({ error: "No pending OTP found" });

    if (record.code !== otp)
      return res.status(400).json({ error: "Invalid OTP" });

    if (new Date(record.expiresAt).getTime() < Date.now()) {
      await expireOtp(record._id);
      return res.status(400).json({ error: "OTP expired" });
    }

    // OTP ok → create user and send password
    const plainPassword = generatePassword();
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const name = record.name || email.split("@")[0];

    try {
      await createUser({ name, email, mobile: record.mobile, passwordHash });
    } catch (e) {
      return res.status(409).json({ error: e.message });
    }

    await markOtpUsed(record._id);

    await sendEmail({
      to: email,
      subject: "Your account password",
      text: `Your account has been created. Your password is: ${plainPassword}`,
      html: `<p>Your account has been created.</p><p>Your password is: <b>${plainPassword}</b></p>`,
    });

    // Notify admin about the new registration
    await sendEmail({
      to: process.env.APP_TO_EMAIL,
      subject: "New user registered",
      text: `A new user has registered.\nName: ${name}\nEmail: ${email}\nMobile: ${record.mobile}`,
      html: `<p>A new user has registered.</p><p><b>Name:</b> ${name}<br/><b>Email:</b> ${email}<br/><b>Mobile:</b> ${record.mobile}</p>`,
    });

    return res.json({ message: "User created. Password sent to email." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to verify OTP" });
  }
});

// 3) Login with email + password → returns JWT and basic user profile
router.post("/login", async (req, res) => {
  try {
    const { value, error } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { email, password } = value;
    const user = await findUserByEmail(email);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    // Build token (keep payload minimal)
    const token = jwt.sign(
      { sub: user._id, email: user.email },
      process.env.JWT_SECRET || "dev",
      { expiresIn: "1h" }
    );

    // Return profile fields requested
    const role = user.role || "user";
    const profile = {
      role,
      username: user.name,
      mobile: user.mobile,
      email: user.email,
      createdAt: user.createdAt,
    };

    // Notify admin about successful login
    try {
      await sendEmail({
        to: process.env.APP_TO_EMAIL,
        subject: "User login notification",
        text: `User ${user.name} (${
          user.email
        }) logged in at ${new Date().toISOString()}`,
        html: `<p>User <b>${user.name}</b> (<b>${
          user.email
        }</b>) logged in at <b>${new Date().toISOString()}</b>.</p>`,
      });
    } catch (e) {
      // Don't block login on email failure
      console.warn("Login email notification failed:", e.message);
    }

    return res.json({ token, user: profile });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Login failed" });
  }
});

// 4) Forgot password: if email exists → send OTP to email (valid 5 minutes)
const forgotSchema = Joi.object({
  email: Joi.string().email().required(),
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { value, error } = forgotSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { email } = value;
    const user = await findUserByEmail(email);
    if (!user)
      return res
        .status(404)
        .json({ error: "No Email address found. Please register." });

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await createOtp({
      name: user.name,
      email: user.email,
      mobile: user.mobile, // required by OTP schema
      code,
      expiresAt,
    });

    await sendEmail({
      to: email,
      subject: "Your password reset OTP",
      text: `Your password reset OTP is ${code}. It expires in 5 minutes`,
      html: `<p>Your password reset OTP is <b>${code}</b>. It expires in 5 minutes.</p>`,
    });

    return res.json({ message: "OTP sent to email" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to start password reset" });
  }
});

// 5) Reset password: verify OTP → update password and email new password
router.post("/reset-password", async (req, res) => {
  try {
    const { value, error } = verifySchema.validate(req.body); // expects { email, otp }
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { email, otp } = value;

    const user = await findUserByEmail(email);
    if (!user)
      return res
        .status(404)
        .json({ error: "No account found. Please register." });

    const record = await getLatestPendingOtp({ email });
    if (!record) return res.status(404).json({ error: "No pending OTP found" });

    if (record.code !== otp)
      return res.status(400).json({ error: "Invalid OTP" });

    if (new Date(record.expiresAt).getTime() < Date.now()) {
      await expireOtp(record._id);
      return res.status(400).json({ error: "OTP expired" });
    }

    const newPassword = generatePassword();
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await updateUserPasswordByEmail(email, passwordHash);
    await markOtpUsed(record._id);

    await sendEmail({
      to: email,
      subject: "Your password has been reset",
      text: `Your new password is: ${newPassword}`,
      html: `<p>Your password has been reset.</p><p>Your new password is: <b>${newPassword}</b></p>`,
    });

    return res.json({ message: "Password reset. New password sent to email." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to reset password" });
  }
});

// Simple JWT auth middleware (expects Authorization: Bearer <token>)
function authRequired(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");
    if (scheme !== "Bearer" || !token) {
      return res
        .status(401)
        .json({ error: "Missing or invalid Authorization header" });
    }
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev");
    req.user = payload; // { sub, email, iat, exp }
    return next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// 6) Change password: auth header required, verify email + old password, then update to new password
const changePasswordSchema = Joi.object({
  email: Joi.string().email().required(),
  oldPassword: Joi.string().min(6).required(),
  newPassword: Joi.string().min(6).required(),
});

router.post("/change-password", authRequired, async (req, res) => {
  try {
    const { value, error } = changePasswordSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { email, oldPassword, newPassword } = value;

    // Ensure the email in body matches the authenticated user
    if (!req.user || req.user.email !== email) {
      return res
        .status(403)
        .json({ error: "Email does not match authenticated user" });
    }

    const user = await findUserByEmail(email);
    if (!user) return res.status(404).json({ error: "User not found" });

    const ok = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!ok)
      return res.status(401).json({ error: "Old password is incorrect" });

    const newHash = await bcrypt.hash(newPassword, 10);
    await updateUserPasswordByEmail(email, newHash);

    return res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to change password" });
  }
});
router.post("/contact", async (req, res) => {
  try {
    const { value, error } = contactSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { name, email, service, message } = value;

    // Build email template
    const subject = `New Contact Request - ${service}`;
    const html = `
      <h2>New Contact Request</h2>
      <p><b>Name:</b> ${name}</p>
      <p><b>Email:</b> ${email}</p>
      <p><b>Service:</b> ${service}</p>
      <p><b>Message:</b></p>
      <p>${message}</p>
    `;

    // Send email (to admin/support)
    await sendEmail({
      to: process.env.APP_TO_EMAIL,
      from: email, // sender email
      subject,
      text: `New contact request from ${name} (${email})\nService: ${service}\nMessage:\n${message}`,
      html,
    });

    return res.json({ message: "Your message has been sent successfully." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to send message" });
  }
});
export default router;
