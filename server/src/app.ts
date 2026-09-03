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
import beautyRecordRoutes from "./routes/beautyRecordRoutes";
import beautyFormulaRoutes from "./routes/beautyFormulaRoutes";
import beautyBeforeAfterRoutes from "./routes/beautyBeforeAfterRoutes";
import beautyPackageRoutes from "./routes/beautyPackageRoutes";
import loyaltyRoutes from "./routes/loyaltyRoutes";
import consentRoutes from "./routes/consentRoutes";
import beautyTattooRoutes from "./routes/beautyTattooRoutes";
import aestheticRoutes from "./routes/aestheticRoutes";
import browLashRoutes from "./routes/browLashRoutes";
import sterilizationRoutes from "./routes/sterilizationRoutes";
import massageRoutes from "./routes/massageRoutes";
import serviceOrderRoutes from "./routes/serviceOrderRoutes";
import personalRoutes from "./routes/personalRoutes";
import nutritionRoutes from "./routes/nutritionRoutes";
import podiatryRoutes from "./routes/podiatryRoutes";
import nursingRoutes from "./routes/nursingRoutes";
import dermatologyRoutes from "./routes/dermatologyRoutes";
import chiropracticRoutes from "./routes/chiropracticRoutes";
import acupunctureRoutes from "./routes/acupunctureRoutes";
import lessonPlanRoutes from "./routes/lessonPlanRoutes";
import maintenancePlanRoutes from "./routes/maintenancePlanRoutes";
import photoJobRoutes from "./routes/photoJobRoutes";
import constructionProjectRoutes from "./routes/constructionProjectRoutes";
import clinicalRecordRoutes from "./routes/clinicalRecordRoutes";
import anamneseRoutes, { publicAnamneseRoutes } from "./routes/anamneseRoutes";

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
  app.use("/api/beauty-records", beautyRecordRoutes);
  app.use("/api/beauty-formulas", beautyFormulaRoutes);
  app.use("/api/beauty-before-after", beautyBeforeAfterRoutes);
  app.use("/api/beauty-packages", beautyPackageRoutes);
  app.use("/api/loyalty", loyaltyRoutes);
  app.use("/api/consents", consentRoutes);
  app.use("/api/beauty-tattoo", beautyTattooRoutes);
  app.use("/api/beauty-aesthetic", aestheticRoutes);
  app.use("/api/beauty-brows", browLashRoutes);
  app.use("/api/sterilization", sterilizationRoutes);
  app.use("/api/beauty-massage", massageRoutes);
  app.use("/api/service-orders", serviceOrderRoutes);
  app.use("/api/personal", personalRoutes);
  app.use("/api/nutrition", nutritionRoutes);
  app.use("/api/podiatry", podiatryRoutes);
  app.use("/api/nursing", nursingRoutes);
  app.use("/api/dermatology", dermatologyRoutes);
  app.use("/api/chiropractic", chiropracticRoutes);
  app.use("/api/acupuncture", acupunctureRoutes);
  app.use("/api/lesson-plans", lessonPlanRoutes);
  app.use("/api/maintenance-plans", maintenancePlanRoutes);
  app.use("/api/photo-jobs", photoJobRoutes);
  app.use("/api/construction-projects", constructionProjectRoutes);
  app.use("/api/clinical-records", clinicalRecordRoutes);
  app.use("/api/public/anamnese", publicAnamneseRoutes);
  app.use("/api/anamnese", anamneseRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
};