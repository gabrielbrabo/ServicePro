import express, { Application } from "express";
import cors from "cors";
import { env } from "./config/env";

import authRoutes from "./routes/authRoutes";
import establishmentRoutes from "./routes/establishmentRoutes";
import serviceRoutes from "./routes/serviceRoutes";
import bookingRoutes from "./routes/bookingRoutes";
import availabilityRoutes from "./routes/availabilityRoutes";
import categoryRoutes from "./routes/categoryRoutes";
import { notFound, errorHandler } from "./middleware/error";
import timeBlockRoutes from "./routes/timeBlockRoutes";
import waitlistRoutes from "./routes/waitlistRoutes";
import cashRoutes from "./routes/cashRoutes";
import medicalRecordRoutes from "./routes/medicalRecordRoutes";
import uploadRoutes from "./routes/uploadRoutes";
import galleryRoutes from "./routes/galleryRoutes";
import productRoutes from "./routes/productRoutes";
import stockRoutes from "./routes/stockRoutes";
import inviteRoutes from "./routes/inviteRoutes";
import notificationRoutes from "./routes/notificationRoutes";

export const createApp = (): Application => {
  const app = express();

  app.use(cors({ origin: env.clientUrl }));
  app.use(express.json());

  // healthcheck
  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  app.use("/api/auth", authRoutes);
  app.use("/api/establishments", establishmentRoutes);
  app.use("/api/services", serviceRoutes);
  app.use("/api/bookings", bookingRoutes);
  app.use("/api/availability", availabilityRoutes);
  app.use("/api/categories", categoryRoutes);
  app.use("/api/timeblocks", timeBlockRoutes);
  app.use("/api/waitlist", waitlistRoutes);
  app.use("/api/cash", cashRoutes);
  app.use("/api/records", medicalRecordRoutes);
  app.use("/api/uploads", uploadRoutes);
  app.use("/api/gallery", galleryRoutes);
  app.use("/api/products", productRoutes);
  app.use("/api/stock", stockRoutes);
  app.use("/api/invites", inviteRoutes);
  app.use("/api/notifications", notificationRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};