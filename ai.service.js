import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import { whatsappRouter } from "./routes/whatsapp.js";
import { ordersRouter } from "./routes/orders.js";
import { catalogRouter } from "./routes/catalog.js";
import { clientsRouter } from "./routes/clients.js";
import { statsRouter } from "./routes/stats.js";
import { authRouter } from "./routes/auth.js";
import { authMiddleware } from "./middleware/auth.js";
import { connectDB } from "./services/database.js";
import { initRedis } from "./services/redis.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000" }));
app.use(express.json());

// Public routes
app.use("/auth", authRouter);
app.use("/webhook", whatsappRouter); // WhatsApp webhook (no auth)

// Protected routes
app.use("/api/orders",  authMiddleware, ordersRouter);
app.use("/api/catalog", authMiddleware, catalogRouter);
app.use("/api/clients", authMiddleware, clientsRouter);
app.use("/api/stats",   authMiddleware, statsRouter);

app.get("/health", (_, res) => res.json({ status: "Julie is alive 🌿" }));

async function start() {
  await connectDB();
  await initRedis();
  app.listen(PORT, () => console.log(`🚀 Julie backend running on port ${PORT}`));
}

start();
