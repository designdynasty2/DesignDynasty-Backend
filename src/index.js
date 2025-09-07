import "dotenv/config";
import express from "express";
import cors from "cors"; // <-- add this
import authRoutes from "./routes/auth.routes.js";
import usersRoutes from "./routes/users.routes.js";
import briefContactRoutes from "./routes/contact.routes.js";
import { connectMongo } from "./db/mongoose.js";

const app = express();

// Allow your frontend origin (adjust as needed)
const ALLOWED_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

app.use(
  cors({
    origin: ALLOWED_ORIGIN,
    credentials: true, // if you use cookies or auth headers
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"], // allow JWT via header
  })
);

app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/auth", authRoutes);
app.use("/users", usersRoutes);
app.use("/api", briefContactRoutes);

const PORT = process.env.PORT || 3000;

connectMongo()
  .then(() => {
    app.listen(PORT, () =>
      console.log(`Server listening on http://localhost:${PORT}`)
    );
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  });
