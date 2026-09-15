import { CashSession } from "../models/CashSession";
import { CashMovement } from "../models/CashMovement";
import { IBooking } from "../models/Booking";
import { Booking } from "../models/Booking";
import { Establishment } from "../models/Establishment";
import { Service } from "../models/Service";
import { User } from "../models/User";
import { Types } from "mongoose";

const VALID_CASH_METHODS = ["dinheiro", "cartao", "pix", "outro"];

// Lanca um booking concluido como ENTRADA na sessao de caixa informada.
// - so lanca se ainda nao foi lancado (payment.postedToCash === false)
// - usa a forma de pagamento gravada no booking (payment.method)
// - copia o professional do booking para o movimento
// - preenche cliente + item (serviço) para os relatórios do caixa
// - marca payment.postedToCash = true no booking
//
// Retorna true se lancou, false se nao (ja lancado / sem method valido).
export const postBookingToCash = async (
  booking: IBooking,
  sessionId: Types.ObjectId,
  postedBy: Types.ObjectId | string
): Promise<boolean> => {
  // ja lancado? nao repete
  if (booking.payment.postedToCash) return false;

  // valor zero (ex.: aulas mensais alem da 1a do mes) nao entra no caixa;
  // marca como lancado para nao ficar reaparecendo na varredura de abertura.
  if (!(booking.payment.amount > 0)) {
    booking.payment.postedToCash = true;
    await booking.save();
    return false;
  }

  // sem forma de pagamento valida, nao lanca (nao sabe o metodo)
  const method = booking.payment.method;
  if (!method || !VALID_CASH_METHODS.includes(method)) return false;

  // se o SINAL ja foi lancado no caixa (movimento proprio), a conclusao lanca
  // apenas o SALDO (total - sinal) — assim sinal + saldo somam o total, sem
  // duplicar. Se o sinal nao entrou no caixa, lanca o valor cheio.
  const depositInCash = booking.payment.depositPostedToCash
    ? booking.payment.depositRequired || 0
    : 0;
  const remainder = booking.payment.amount - depositInCash;

  // ja pago 100% pelo sinal: nada a lancar aqui, so marca como lancado
  if (!(remainder > 0)) {
    booking.payment.postedToCash = true;
    await booking.save();
    return false;
  }

  // descricao amigavel com o titulo do servico
  let serviceTitle = "Serviço";
  const svc = await Service.findById(booking.service).select("title");
  if (svc?.title) serviceTitle = svc.title;
  // deixa claro no historico que este lancamento e o saldo (sinal ja lancado)
  const description = depositInCash > 0 ? `${serviceTitle} (saldo)` : serviceTitle;

  // nome do cliente (snapshot) para o histórico e relatórios do caixa
  let clientName = "";
  try {
    const u = await User.findById(booking.client).select("name");
    if (u?.name) clientName = u.name;
  } catch {
    /* nome do cliente é opcional no lançamento */
  }

  const amount = remainder;
  const paymentMethod = method as "dinheiro" | "cartao" | "pix" | "outro";

  try {
    await CashMovement.create({
      session: sessionId,
      establishment: booking.establishment,
      createdBy: postedBy,
      type: "entrada",
      method: paymentMethod,
      amount,
      description,
      booking: booking._id,
      professional: booking.professional ?? null,
      client: booking.client ?? null,
      clientName,
      items: [
        {
          kind: "servico",
          refId: booking.service ?? null,
          name: description,
          qty: 1,
          unitPrice: amount,
          total: amount,
        },
      ],
      payments: [{ method: paymentMethod, amount }],
    });
  } catch (err: unknown) {
    // colisao do indice unico de booking = ja foi lancado por outra via
    if ((err as { code?: number })?.code === 11000) {
      await Booking.updateOne(
        { _id: booking._id },
        { $set: { "payment.postedToCash": true } }
      );
      return false;
    }
    throw err;
  }

  // marca o booking como lancado
  booking.payment.postedToCash = true;
  await booking.save();
  return true;
};

// Lanca o SINAL (pre-pagamento) como ENTRADA na sessao de caixa, num movimento
// PROPRIO. O campo `booking` fica null de proposito: o indice unico por booking
// e reservado para o lancamento da CONCLUSAO (saldo), entao sinal + saldo
// convivem sem colidir. Dedup pelo flag payment.depositPostedToCash.
//
// Retorna true se lancou, false se nao (sem sinal / nao pago / ja lancado).
export const postDepositToCash = async (
  booking: IBooking,
  sessionId: Types.ObjectId,
  postedBy: Types.ObjectId | string
): Promise<boolean> => {
  const p = booking.payment;
  if (!((p.depositRequired || 0) > 0) || !p.depositPaid || p.depositPostedToCash) {
    return false;
  }

  const amount = p.depositRequired || 0;
  const rawMethod = p.depositMethod || "pix";
  const method = (
    VALID_CASH_METHODS.includes(rawMethod) ? rawMethod : "pix"
  ) as "dinheiro" | "cartao" | "pix" | "outro";

  let serviceTitle = "Serviço";
  const svc = await Service.findById(booking.service).select("title");
  if (svc?.title) serviceTitle = svc.title;

  let clientName = "";
  try {
    const u = await User.findById(booking.client).select("name");
    if (u?.name) clientName = u.name;
  } catch {
    /* nome do cliente e opcional */
  }

  const description = `Sinal - ${serviceTitle}`;
  await CashMovement.create({
    session: sessionId,
    establishment: booking.establishment,
    createdBy: postedBy,
    type: "entrada",
    method,
    amount,
    description,
    booking: null, // ver comentario acima (indice unico e do saldo)
    professional: booking.professional ?? null,
    client: booking.client ?? null,
    clientName,
    items: [
      {
        kind: "servico",
        refId: booking.service ?? null,
        name: description,
        qty: 1,
        unitPrice: amount,
        total: amount,
      },
    ],
    payments: [{ method, amount }],
  });

  booking.payment.depositPostedToCash = true;
  await booking.save();
  return true;
};

// Lanca o sinal no caixa SE houver uma sessao aberta e o estabelecimento
// tiver o lancamento automatico ligado. Sem sessao aberta, o sinal e lancado
// depois, na abertura do caixa (postPendingBookingsForDate).
export const postDepositIfSessionOpen = async (
  booking: IBooking,
  postedBy: Types.ObjectId | string
): Promise<boolean> => {
  const p = booking.payment;
  if (!((p.depositRequired || 0) > 0) || !p.depositPaid || p.depositPostedToCash) {
    return false;
  }
  const est = await Establishment.findById(booking.establishment).select(
    "cashAutoEntry"
  );
  if (est?.cashAutoEntry === false) return false;
  const openSession = await CashSession.findOne({
    establishment: booking.establishment,
    status: "aberto",
  });
  if (!openSession) return false;
  return postDepositToCash(booking, openSession._id, postedBy);
};

// Varre TODOS os bookings concluidos + nao lancados do estabelecimento
// (independente da data) e lanca cada um na sessao. Usado ao abrir o caixa.
//
// (Mantem o nome antigo por compatibilidade com quem chama; o parametro
// referenceDate nao e mais usado no filtro, mas fica na assinatura para
// nao quebrar a chamada existente no cashController.)
export const postPendingBookingsForDate = async (
  establishmentId: Types.ObjectId | string,
  sessionId: Types.ObjectId,
  _referenceDate: Date,
  postedBy: Types.ObjectId | string
): Promise<number> => {
  const pendentes = await Booking.find({
    establishment: establishmentId,
    status: "concluido",
    "payment.postedToCash": false,
  });

  let count = 0;
  for (const b of pendentes) {
    const posted = await postBookingToCash(b, sessionId, postedBy);
    if (posted) count++;
  }

  // sinais ja pagos de agendamentos AINDA NAO concluidos: lanca agora para
  // aparecerem no caixa (os concluidos ja foram tratados no laco acima, que
  // lanca o valor cheio quando o sinal nao entrou separado).
  const depositPend = await Booking.find({
    establishment: establishmentId,
    status: { $ne: "concluido" },
    "payment.depositRequired": { $gt: 0 },
    "payment.depositPaid": true,
    "payment.depositPostedToCash": false,
  });
  for (const b of depositPend) {
    const posted = await postDepositToCash(b, sessionId, postedBy);
    if (posted) count++;
  }

  return count;
};
