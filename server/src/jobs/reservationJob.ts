import { expireReservations } from "../utils/autoReserve";

// intervalo de verificacao das reservas vencidas
const CHECK_INTERVAL_MS = 2 * 60 * 1000; // 2 minutos

let timer: NodeJS.Timeout | null = null;

// Inicia o job de expiracao de reservas automaticas.
// Chamado uma vez na subida do servidor.
export const startReservationJob = (): void => {
  if (timer) return; // evita iniciar duas vezes

  const tick = async () => {
    try {
      const count = await expireReservations();
      if (count > 0) {
        console.log(`⏱️  ${count} reserva(s) expirada(s) e repassada(s)`);
      }
    } catch (err) {
      console.error("reservationJob:", err);
    }
  };

  // roda uma vez logo na subida (pega o que venceu enquanto o servidor esteve fora)
  void tick();

  timer = setInterval(tick, CHECK_INTERVAL_MS);
  console.log("⏱️  Job de expiracao de reservas iniciado");
};

export const stopReservationJob = (): void => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
};