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
import evolutionRoutes from "./routes/evolutionRoutes";
import physioRoutes from "./routes/physioRoutes";
import periogramRoutes from "./routes/periogramRoutes";
import uploadRoutes from "./routes/uploadRoutes";
import galleryRoutes from "./routes/galleryRoutes";
import productRoutes from "./routes/productRoutes";
import stockRoutes from "./routes/stockRoutes";
import inviteRoutes from "./routes/inviteRoutes";
import notificationRoutes from "./routes/notificationRoutes";
import reviewRoutes from "./routes/reviewRoutes";
import treatmentPlanRoutes from "./routes/treatmentPlanRoutes";
import odontogramRoutes from "./routes/odontogramRoutes";
import emittedDocumentRoutes from "./routes/emittedDocumentRoutes";
import commissionRoutes from "./routes/commissionRoutes";
import auditRoutes from "./routes/auditRoutes";
import convenioRoutes from "./routes/convenioRoutes";

export const createApp = (): Application => {
  const app = express();

  app.use(cors({ origin: env.clientUrl }));
  // guarda o corpo bruto (rawBody) para validar a assinatura HMAC do webhook
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as unknown as { rawBody?: Buffer }).rawBody = buf;
      },
    })
  );

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
  app.use("/api/evolutions", evolutionRoutes);
  app.use("/api/physio", physioRoutes);
  app.use("/api/periogram", periogramRoutes);
  app.use("/api/uploads", uploadRoutes);
  app.use("/api/gallery", galleryRoutes);
  app.use("/api/products", productRoutes);
  app.use("/api/stock", stockRoutes);
  app.use("/api/invites", inviteRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/reviews", reviewRoutes);
  app.use("/api/treatment-plans", treatmentPlanRoutes);
  app.use("/api/odontogram", odontogramRoutes);
  app.use("/api/documents", emittedDocumentRoutes);
  app.use("/api/commissions", commissionRoutes);
  app.use("/api/audit", auditRoutes);
  app.use("/api/convenios", convenioRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};