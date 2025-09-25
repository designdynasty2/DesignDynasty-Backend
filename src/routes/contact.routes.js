import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import Joi from "joi";
import { sendEmail } from "../utils/email.js";

const router = express.Router();

// Ensure uploads/brief-contacts folder exists
const uploadDir = path.join(process.cwd(), "uploads/brief-contacts");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir); // folder where files will be stored
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // max 5 MB for multer itself
});

// Joi schema
const briefContactSchema = Joi.object({
  name: Joi.string().min(3).required(),
  email: Joi.string().email().required(),
  mobile: Joi.string().required(),
  company: Joi.string().min(2).required(),
  service: Joi.string().required(),
  projectDetails: Joi.string().min(3).required(),
});

// POST /brief-contact
router.post("/brief-contact", upload.single("attachment"), async (req, res) => {
  try {
    const { error, value } = briefContactSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // If file exists, validate size
    if (req.file && req.file.size > 1 * 1024 * 1024) {
      return res.status(400).json({ error: "Attachment must be less than 1 MB" });
    }

    const { name, email, mobile, company, service, projectDetails } = value;

    const subject = `Brief Contact Request - ${service}`;
    const html = `
      <h2>New Brief Contact Request</h2>
      <p><b>Name:</b> ${name}</p>
      <p><b>Email:</b> ${email}</p>
      <p><b>Mobile:</b> ${mobile}</p>
      <p><b>Company:</b> ${company}</p>
      <p><b>Service:</b> ${service}</p>
      <p><b>Project Details:</b></p>
      <p>${projectDetails}</p>
    `;

    const attachments = req.file
      ? [
          {
            filename: req.file.originalname,
            path: req.file.path,
          },
        ]
      : [];

    await sendEmail({
      to: process.env.APP_TO_EMAIL,
      from: email,
      subject,
      text: `New brief contact request from ${name} (${email})
Mobile: ${mobile}
Company: ${company}
Service: ${service}
Project Details:
${projectDetails}`,
      html,
      attachments,
    });

    return res.json({
      message: "Your brief contact has been sent successfully.",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to send brief contact" });
  }
});

export default router;
