import { CashSession } from "../models/CashSession";
import { CashMovement } from "../models/CashMovement";
import { IBooking } from "../models/Booking";
import { Booking } from "../models/Booking";
import { Service } from "../models/Service";
import { User } from "../models/User";
import { Types } from "mongoose";

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
  const validMethods = ["dinheiro", "cartao", "pix", "outro"];
  if (!method || !validMethods.includes(method)) return false;

  // descricao amigavel com o titulo do servico
  let serviceTitle = "Serviço";
  const svc = await Service.findById(booking.service).select("title");
  if (svc?.title) serviceTitle = svc.title;

  // nome do cliente (snapshot) para o histórico e relatórios do caixa
  let clientName = "";
  try {
    const u = await User.findById(booking.client).select("name");
    if (u?.name) clientName = u.name;
  } catch {
    /* nome do cliente é opcional no lançamento */
  }

  const amount = booking.payment.amount;
  const paymentMethod = method as "dinheiro" | "cartao" | "pix" | "outro";

  try {
    await CashMovement.create({
      session: sessionId,
      establishment: booking.establishment,
      createdBy: postedBy,
      type: "entrada",
      method: paymentMethod,
      amount,
      description: serviceTitle,
      booking: booking._id,
      professional: booking.professional ?? null,
      client: booking.client ?? null,
      clientName,
      items: [
        {
          kind: "servico",
          refId: booking.service ?? null,
          name: serviceTitle,
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
  return count;
};
