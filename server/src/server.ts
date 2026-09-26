// monitoramento de erros: tem que vir ANTES de tudo
import "./instrument";
import http from "http";
import { createApp } from "./app";
import { connectDB } from "./config/db";
import { initSocket } from "./socket";
import { env } from "./config/env";
import { startReservationJob } from "./jobs/reservationJob";
import { startReminderJob } from "./jobs/reminderJob";
import { startAffiliatePayoutJob } from "./jobs/affiliatePayoutJob";
import { migrateReviewIndex } from "./utils/reviewIndexMigration";

const start = async (): Promise<void> => {
  await connectDB();
  await migrateReviewIndex();

  const app = createApp();
  const server = http.createServer(app);

  initSocket(server);

  server.listen(env.port, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${env.port}`);
  });

  startReservationJob();
  startReminderJob();
  startAffiliatePayoutJob();
};

start();