import express from "express";
import jwt from "jsonwebtoken";
import { findUserByEmail, listUsers } from "../models/user.model.js";

const router = express.Router();

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

// GET /users - admin only
router.get("/", authRequired, async (req, res) => {
  try {
    // Fetch current user to verify admin role
    const me = await findUserByEmail(req.user?.email || "");
    if (!me) return res.status(401).json({ error: "Unauthorized" });
    if (me.role !== "admin") {
      return res.status(403).json({ error: "Forbidden: admin role required" });
    }

    const users = await listUsers();
    return res.json({ users });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to fetch users" });
  }
});

export default router;
