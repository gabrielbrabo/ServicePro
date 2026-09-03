import mongoose from "mongoose";

// ---------------------------------------------------------------------------
// Migracao do indice de avaliacoes: passamos de "1 avaliacao por (cliente +
// servico)" para "1 avaliacao por ATENDIMENTO (booking)". O indice unico antigo
// (client_1_service_1) precisa ser removido, senao o Mongo continua barrando a
// 2a avaliacao do mesmo servico. Idempotente e tolerante a falha.
// ---------------------------------------------------------------------------
export async function migrateReviewIndex(): Promise<void> {
  try {
    const coll = mongoose.connection.collection("reviews");
    const indexes = await coll.indexes();
    if (indexes.some((i) => i.name === "client_1_service_1")) {
      await coll.dropIndex("client_1_service_1");
      console.log("🔧 reviews: indice client_1_service_1 removido (migracao)");
    }
    // garante o novo indice unico por agendamento
    await coll.createIndex({ booking: 1 }, { unique: true });
  } catch (err) {
    console.error("migrateReviewIndex:", err);
  }
}
