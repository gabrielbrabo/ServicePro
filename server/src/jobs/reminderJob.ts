import { sendDueReminders } from "../utils/bookingReminders";

// intervalo de verificacao dos lembretes. 5 min mantem util a opcao mais curta
// (15 min antes sai entre 15 e 20 min antes). A query e leve e indexada, entao
// rodar a cada 5 min nao pesa.
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos

let timer: NodeJS.Timeout | null = null;

// Inicia o job de lembretes de agendamento.
// Chamado uma vez na subida do servidor.
export const startReminderJob = (): void => {
  if (timer) return; // evita iniciar duas vezes

  const tick = async () => {
    try {
      const count = await sendDueReminders();
      if (count > 0) {
        console.log(`🔔 ${count} lembrete(s) de agendamento enviado(s)`);
      }
    } catch (err) {
      console.error("reminderJob:", err);
    }
  };

  // roda uma vez logo na subida (pega o que venceu enquanto o servidor esteve fora)
  void tick();

  timer = setInterval(tick, CHECK_INTERVAL_MS);
  console.log("🔔 Job de lembretes de agendamento iniciado");
};

export const stopReminderJob = (): void => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
};